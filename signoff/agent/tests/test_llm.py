"""Failure matrix, cache labeling, budget race, and provider tests for the LLM layer."""

import asyncio
from datetime import UTC, datetime, timedelta
from decimal import Decimal

import httpx
import pytest
from fastapi.testclient import TestClient
from pydantic import BaseModel, ConfigDict

from agent.app.agent.budget import DailyBudget
from agent.app.agent.cache import ScenarioCache
from agent.app.agent.llm import (
    FakeProvider,
    LLMFailure,
    LLMFailureKind,
    LLMMode,
    LLMPlanResult,
    LLMProvider,
    LLMService,
    OpenAICompatibleProvider,
    ProviderError,
    ProviderResponse,
    parse_plan,
)
from agent.app.db.session import get_db_session
from agent.app.main import create_app
from agent.app.settings import AppEnv, PayPalEnv, Settings

PROMPT = "Propose the next action for this dispute."
VALID_JSON = '{"actions": [{"action_type": "PROVIDE_EVIDENCE"}]}'
EMPTY_JSON = '{"actions": []}'
EXTRA_JSON = '{"actions": [{"action_type": "PROVIDE_EVIDENCE", "unexpected": true}]}'


class Action(BaseModel):
    model_config = ConfigDict(extra="forbid")

    action_type: str


class Plan(BaseModel):
    model_config = ConfigDict(extra="forbid")

    actions: list[Action]


class PermissivePlan(BaseModel):
    actions: list[Action]


class SlowProvider:
    async def complete(self, messages: list[dict[str, str]]) -> ProviderResponse:
        await asyncio.sleep(1)
        return ProviderResponse(VALID_JSON)


class SlowValidProvider:
    def __init__(self) -> None:
        self.calls = 0

    async def complete(self, messages: list[dict[str, str]]) -> ProviderResponse:
        self.calls += 1
        await asyncio.sleep(0.01)
        return ProviderResponse(VALID_JSON)


class Clock:
    def __init__(self, now: datetime) -> None:
        self.now = now

    def __call__(self) -> datetime:
        return self.now


async def make_service(
    responses: list[ProviderResponse | Exception] | None = None,
    *,
    provider: LLMProvider | None = None,
    cache_enabled: bool = True,
    cap: str = "1.00",
    cost: str = "0.01",
    timeout: float = 1.0,
) -> tuple[LLMService, FakeProvider, ScenarioCache, DailyBudget]:
    fake = FakeProvider(responses or [])
    service = LLMService(
        provider=provider if provider is not None else fake,
        cache=ScenarioCache(enabled=cache_enabled),
        budget=DailyBudget(Decimal(cap)),
        cost_per_call_usd=Decimal(cost),
        timeout=timeout,
    )
    return service, fake, service._cache, service._budget


@pytest.mark.asyncio
async def test_success_returns_validated_plan_and_is_not_cached_labelled():
    service, fake, _, _ = await make_service([ProviderResponse(VALID_JSON)])

    result = await service.generate(PROMPT, input_hash="h1", prompt_version="v1", schema=Plan)

    assert isinstance(result, LLMPlanResult)
    assert isinstance(result.plan, Plan)
    assert result.plan.actions[0].action_type == "PROVIDE_EVIDENCE"
    assert result.cached is False
    assert result.attempts == 1
    assert fake.calls == 1


@pytest.mark.asyncio
async def test_cache_hit_is_flagged_cached_reasoning():
    service, fake, _, _ = await make_service([ProviderResponse(VALID_JSON)])

    first = await service.generate(PROMPT, input_hash="h1", prompt_version="v1", schema=Plan)
    second = await service.generate(PROMPT, input_hash="h1", prompt_version="v1", schema=Plan)

    assert isinstance(first, LLMPlanResult)
    assert isinstance(second, LLMPlanResult)
    assert second.cached is True
    assert second.attempts == 0
    assert fake.calls == 1


@pytest.mark.asyncio
async def test_prompt_version_bump_invalidates_cache():
    service, fake, cache, _ = await make_service(
        [ProviderResponse(VALID_JSON), ProviderResponse(VALID_JSON)]
    )

    await service.generate(PROMPT, input_hash="h1", prompt_version="v1", schema=Plan)
    second = await service.generate(PROMPT, input_hash="h1", prompt_version="v2", schema=Plan)

    assert isinstance(second, LLMPlanResult)
    assert second.cached is False
    assert fake.calls == 2
    assert len(cache) == 2


@pytest.mark.asyncio
async def test_input_hash_change_invalidates_cache():
    service, fake, _, _ = await make_service([ProviderResponse(VALID_JSON), ProviderResponse(VALID_JSON)])

    await service.generate(PROMPT, input_hash="h1", prompt_version="v1", schema=Plan)
    second = await service.generate(PROMPT, input_hash="h2", prompt_version="v1", schema=Plan)

    assert isinstance(second, LLMPlanResult)
    assert second.cached is False
    assert fake.calls == 2


@pytest.mark.asyncio
async def test_invalid_json_is_repaired_once():
    service, fake, _, _ = await make_service([ProviderResponse("not json"), ProviderResponse(VALID_JSON)])

    result = await service.generate(PROMPT, input_hash="h1", prompt_version="v1", schema=Plan)

    assert isinstance(result, LLMPlanResult)
    assert result.attempts == 2
    assert fake.calls == 2
    assert "invalid" in fake.messages[1][-1]["content"].lower()


@pytest.mark.asyncio
async def test_invalid_json_twice_is_typed_failure():
    service, fake, _, _ = await make_service([ProviderResponse("not json"), ProviderResponse("still not json")])

    result = await service.generate(PROMPT, input_hash="h1", prompt_version="v1", schema=Plan)

    assert isinstance(result, LLMFailure)
    assert result.kind == LLMFailureKind.invalid_json
    assert result.attempts == 2
    assert fake.calls == 2


@pytest.mark.asyncio
async def test_invalid_schema_twice_is_typed_failure():
    bad = '{"actions": [{}]}'
    service, _, _, _ = await make_service([ProviderResponse(bad), ProviderResponse(bad)])

    result = await service.generate(PROMPT, input_hash="h1", prompt_version="v1", schema=Plan)

    assert isinstance(result, LLMFailure)
    assert result.kind == LLMFailureKind.invalid_schema


@pytest.mark.asyncio
async def test_extra_fields_are_rejected_and_typed():
    service, fake, _, _ = await make_service([ProviderResponse(EXTRA_JSON), ProviderResponse(EXTRA_JSON)])

    result = await service.generate(PROMPT, input_hash="h1", prompt_version="v1", schema=Plan)

    assert isinstance(result, LLMFailure)
    assert result.kind == LLMFailureKind.extra_fields
    assert "unexpected" in result.message
    assert fake.calls == 2


@pytest.mark.asyncio
async def test_empty_plan_is_typed_and_not_repaired():
    service, fake, _, _ = await make_service([ProviderResponse(EMPTY_JSON), ProviderResponse(VALID_JSON)])

    result = await service.generate(PROMPT, input_hash="h1", prompt_version="v1", schema=Plan)

    assert isinstance(result, LLMFailure)
    assert result.kind == LLMFailureKind.empty_plan
    assert fake.calls == 1


@pytest.mark.asyncio
async def test_refusal_text_is_typed():
    service, fake, _, _ = await make_service([ProviderResponse("I cannot help with that.")])

    result = await service.generate(PROMPT, input_hash="h1", prompt_version="v1", schema=Plan)

    assert isinstance(result, LLMFailure)
    assert result.kind == LLMFailureKind.refusal
    assert fake.calls == 1


@pytest.mark.asyncio
async def test_content_filter_refusal_is_typed():
    service, _, _, _ = await make_service(
        [ProviderResponse("{}", finish_reason="content_filter")]
    )

    result = await service.generate(PROMPT, input_hash="h1", prompt_version="v1", schema=Plan)

    assert isinstance(result, LLMFailure)
    assert result.kind == LLMFailureKind.refusal


@pytest.mark.asyncio
async def test_empty_response_is_repaired():
    service, fake, _, _ = await make_service([ProviderResponse(""), ProviderResponse(VALID_JSON)])

    result = await service.generate(PROMPT, input_hash="h1", prompt_version="v1", schema=Plan)

    assert isinstance(result, LLMPlanResult)
    assert fake.calls == 2


@pytest.mark.asyncio
async def test_timeout_is_typed():
    service, _, _, _ = await make_service(provider=SlowProvider(), timeout=0.01)

    result = await service.generate(PROMPT, input_hash="h1", prompt_version="v1", schema=Plan)

    assert isinstance(result, LLMFailure)
    assert result.kind == LLMFailureKind.timeout


@pytest.mark.asyncio
async def test_provider_rate_limit_is_typed():
    service, _, _, _ = await make_service(
        [ProviderError(LLMFailureKind.rate_limited, "rate limited")]
    )

    result = await service.generate(PROMPT, input_hash="h1", prompt_version="v1", schema=Plan)

    assert isinstance(result, LLMFailure)
    assert result.kind == LLMFailureKind.rate_limited


@pytest.mark.asyncio
async def test_provider_5xx_is_typed():
    service, _, _, _ = await make_service(
        [ProviderError(LLMFailureKind.provider_error, "server error")]
    )

    result = await service.generate(PROMPT, input_hash="h1", prompt_version="v1", schema=Plan)

    assert isinstance(result, LLMFailure)
    assert result.kind == LLMFailureKind.provider_error


@pytest.mark.asyncio
async def test_budget_exhausted_never_calls_provider():
    service, fake, _, _ = await make_service([ProviderResponse(VALID_JSON)], cap="0.00")

    result = await service.generate(PROMPT, input_hash="h1", prompt_version="v1", schema=Plan)

    assert isinstance(result, LLMFailure)
    assert result.kind == LLMFailureKind.budget_exhausted
    assert fake.calls == 0


@pytest.mark.asyncio
async def test_missing_provider_uses_cache_then_reports_unavailable():
    cache = ScenarioCache(enabled=True)
    cache.put("v1", "h1", Plan(actions=[Action(action_type="PROVIDE_EVIDENCE")]))
    service = LLMService(
        provider=None,
        cache=cache,
        budget=DailyBudget(Decimal("1.00")),
    )

    hit = await service.generate(PROMPT, input_hash="h1", prompt_version="v1", schema=Plan)
    miss = await service.generate(PROMPT, input_hash="h2", prompt_version="v1", schema=Plan)

    assert isinstance(hit, LLMPlanResult)
    assert hit.cached is True
    assert isinstance(miss, LLMFailure)
    assert miss.kind == LLMFailureKind.unavailable


@pytest.mark.asyncio
async def test_invalid_output_never_enters_cache():
    service, fake, cache, _ = await make_service(
        [ProviderResponse("not json"), ProviderResponse("not json"), ProviderResponse(VALID_JSON)]
    )

    failed = await service.generate(PROMPT, input_hash="h1", prompt_version="v1", schema=Plan)
    assert isinstance(failed, LLMFailure)
    assert len(cache) == 0

    succeeded = await service.generate(PROMPT, input_hash="h1", prompt_version="v1", schema=Plan)
    assert isinstance(succeeded, LLMPlanResult)
    assert succeeded.cached is False
    assert fake.calls == 3
    assert len(cache) == 1


def test_schema_without_extra_forbid_is_rejected():
    with pytest.raises(ValueError, match="extra='forbid'"):
        parse_plan(VALID_JSON, None, PermissivePlan)


@pytest.mark.asyncio
async def test_budget_race_never_overspends():
    budget = DailyBudget(Decimal("0.05"))
    results = await asyncio.gather(*(budget.reserve(Decimal("0.01")) for _ in range(20)))

    assert sum(results) == 5
    assert budget.spent_usd == Decimal("0.05")


@pytest.mark.asyncio
async def test_service_budget_race_never_overspends():
    provider = SlowValidProvider()
    service = LLMService(
        provider=provider,
        cache=ScenarioCache(enabled=False),
        budget=DailyBudget(Decimal("0.05")),
        cost_per_call_usd=Decimal("0.01"),
    )

    results = await asyncio.gather(
        *(
            service.generate(PROMPT, input_hash=f"h{i}", prompt_version="v1", schema=Plan)
            for i in range(20)
        )
    )

    plans = [result for result in results if isinstance(result, LLMPlanResult)]
    failures = [result for result in results if isinstance(result, LLMFailure)]
    assert len(plans) == 5
    assert all(result.kind == LLMFailureKind.budget_exhausted for result in failures)
    assert provider.calls == 5


@pytest.mark.asyncio
async def test_budget_rolls_over_at_utc_midnight():
    clock = Clock(datetime(2026, 10, 20, 12, 0, tzinfo=UTC))
    budget = DailyBudget(Decimal("1.00"), clock=clock)

    assert await budget.reserve(Decimal("1.00")) is True
    assert await budget.reserve(Decimal("0.01")) is False

    clock.now += timedelta(days=1)
    assert await budget.reserve(Decimal("1.00")) is True
    assert budget.spent_usd == Decimal("1.00")


def test_mode_reflects_provider_cache_and_budget():
    cache = ScenarioCache(enabled=True)
    budget = DailyBudget(Decimal("1.00"))
    fake = FakeProvider([ProviderResponse(VALID_JSON)])

    assert LLMService(provider=fake, cache=cache, budget=budget).mode == LLMMode.LIVE
    assert LLMService(provider=None, cache=cache, budget=budget).mode == LLMMode.CACHED
    assert (
        LLMService(provider=None, cache=ScenarioCache(enabled=False), budget=budget).mode
        == LLMMode.UNAVAILABLE
    )
    assert (
        LLMService(provider=fake, cache=cache, budget=DailyBudget(Decimal("0.00"))).mode
        == LLMMode.CACHED
    )


def test_status_endpoint_exposes_llm_mode():
    settings = Settings(
        app_env=AppEnv.test,
        paypal_env=PayPalEnv.stub,
        llm_api_key="",
        llm_api_base_url="",
        llm_model="",
        use_scenario_cache=True,
    )
    app = create_app(settings)
    # Status mode must be testable without a database.
    app.dependency_overrides[get_db_session] = lambda: object()
    response = TestClient(app).get("/api/status")

    assert response.status_code == 200
    assert response.json()["llm_mode"] == "CACHED"


@pytest.mark.asyncio
async def test_openai_provider_maps_http_statuses():
    cases = [
        (429, LLMFailureKind.rate_limited),
        (503, LLMFailureKind.provider_error),
        (400, LLMFailureKind.provider_error),
    ]
    for status_code, expected in cases:

        def handler(request: httpx.Request, status_code: int = status_code) -> httpx.Response:
            return httpx.Response(status_code, json={"error": "nope"})

        async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
            provider = OpenAICompatibleProvider(
                api_key="test-key",
                base_url="https://llm.example.test/v1",
                model="test-model",
                http_client=client,
            )
            with pytest.raises(ProviderError) as exc_info:
                await provider.complete([{"role": "user", "content": "hi"}])
            assert exc_info.value.kind == expected


@pytest.mark.asyncio
async def test_openai_provider_parses_content():
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            json={"choices": [{"message": {"content": VALID_JSON}, "finish_reason": "stop"}]},
        )

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        provider = OpenAICompatibleProvider(
            api_key="test-key",
            base_url="https://llm.example.test/v1",
            model="test-model",
            http_client=client,
        )
        response = await provider.complete([{"role": "user", "content": "hi"}])

    assert response.content == VALID_JSON
    assert response.finish_reason == "stop"


@pytest.mark.asyncio
async def test_openai_provider_maps_timeout():
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ReadTimeout("too slow", request=request)

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        provider = OpenAICompatibleProvider(
            api_key="test-key",
            base_url="https://llm.example.test/v1",
            model="test-model",
            http_client=client,
        )
        with pytest.raises(ProviderError) as exc_info:
            await provider.complete([{"role": "user", "content": "hi"}])

    assert exc_info.value.kind == LLMFailureKind.timeout
