# Type testing

Goal: types that describe the real inputs and outputs, and tests that fail when someone loosens them.

## Layers
1. **Compile-time type tests** in `*.test-d.ts` using the test runner's type-check mode. Each positive assertion is paired with at least one negative case marked as an expected type error. An unused expected-error marker fails the check, so loosening a type breaks a test.
2. **Boundary schemas** (zod in the api-client, pydantic in the agent) for everything crossing a trust boundary: URL params, form input, storage, environment, webhook bodies, LLM output. Each has a table test.
3. **Contract and parity tests:** generated client is current; enum values match across the OpenAPI spec, TypeScript unions and Python enums; every file in `fixtures/paypal/` and `fixtures/ui/` conforms to its schema and type.
4. **Python typing:** strict mypy, exhaustive handling with a never-check, and negative typing cases for the two safety types (gate decision and executor input).

## Boundary input table (apply to every parser)
Empty, whitespace only, minimum and maximum length, unicode and right-to-left text, negative, zero, huge, wrong type, extra fields, missing fields, null versus absent, leading zeros, more decimals than allowed.

## Mandatory catalog (grow it as steps add types)
| Area | The types must guarantee |
|---|---|
| Verdict, ActionType, ScenarioId, DisputeReason | Exact unions; adding or removing a member fails a test |
| Money | Branded string; a number and a plain string are both rejected; only the parser creates it |
| Ids | Dispute id, approval token, order code, session id are not interchangeable |
| ResolveRequest | Union of approve, deny, edit; edit needs at least one of amount or message |
| Create-order request | No price field; quantity bounded |
| Create-dispute request | Reason limited to supported reasons; amount is Money |
| API responses | Not `any`; required fields non-optional; absent values explicitly nullable (for example due date) |
| Server-owned fields | Verdict, rule id and fingerprint never appear in any request type |
| Timeline events | Union keyed by kind; an exhaustive switch compiles only if every kind is handled |
| Client calls | Path parameters required; wrong method or path fails to compile |
| Assistant tools | Constant list; adding a mutation tool name fails a test |
| Widget configs | Derived from api-client types, not re-declared |
| Rule ids | Match the `G<n>-<nn>` pattern type or the allowed special ids |

## Rules
- No type is hand-copied from the backend; if the spec cannot express a rule, add a boundary schema and a table test, and say so in the step's review log.
- Any change to a type needs a type test change in the same commit.
- Python: gate and executor negative tests prove that a raw action cannot be passed where an allowed decision is required.
