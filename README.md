# Signoff

Signoff helps small online sellers handle PayPal disputes. It gathers available order evidence, uses AI to propose a response, and checks the proposal against limits set by the merchant. Depending on the case and those limits, Signoff can take an allowed action or ask the merchant for approval.

This is a **PayPal sandbox demo**. The shop and shipment tracking are simulated; no real money is used.

## Try Signoff

- **Shop:** https://signoff-shop.onrender.com
- **Signoff merchant app:** https://signoff.simeonakin.me
- **Product landing page:** https://signoff.simeonakin.me/landingpage
- **PayPal Resolution Center:** https://www.sandbox.paypal.com/disputes/

The Signoff root URL redirects to `/app`. Visitors who need to sign in go through the existing login screen.

Judges: find the shared Signoff login and PayPal sandbox buyer credentials in the Devpost submission's testing instructions. Everyone uses the same test merchant account. Use the order details to identify your own order and dispute.

### Follow an order through a dispute

1. **Optional: enable notifications first.** Sign in to Signoff, open **More → Settings → Notifications**, and enable push notifications on your device. Allow notifications in your browser when prompted.
2. In the **shop**, select an item, choose a quantity, and click **Add to Cart**. Open the cart at the top right and choose **Pay with PayPal**. Select the PayPal payment option, sign in with the sandbox buyer credentials, and complete the payment.
3. On the order confirmation page, click **Track this order**. The shop uses simulated shipping: each shipment step advances automatically in about one minute. In Signoff's **Shipments** page, you can also open the order and use the simulated shipment controls to advance it manually.
4. **Optional: try the automatic-refund scenario.** In the merchant's limits, select **Allow settlement within signing limits** for missing delivery. Immediately after placing the order, open **Shipments** in Signoff, find your order, open **Simulated shipment controls**, and select **Withhold tracking** before opening the dispute. The outcome depends on the case and the merchant's signing limits.
5. On the order tracking page, scroll down and select **Open PayPal Resolution Center**. Sign in with the sandbox buyer account, select your transaction, choose **Report a problem**, and follow PayPal's prompts to submit the dispute.
6. Open Signoff and go to **Updates**. The submitted dispute usually appears in about two minutes. Select the update for your new dispute to open its details. Inspect the available evidence, the agent's actions, and the decision or approval requested under the merchant's limits.

The buyer opens the dispute in PayPal, not in the shop. Use the sandbox accounts supplied with the submission and keep the shared merchant account available for other judges.

## How it works

PayPal sandbox checkout creates the payment. After the buyer opens a dispute in PayPal, Signoff receives a verified webhook, collects available dispute and order information, and prepares a response. The AI proposes a plan; a separate rules-based gate checks it against the merchant's settings and PayPal's available actions. Signoff records the decision and requests approval where needed.

| Part | In this demo |
| --- | --- |
| Payment and disputes | PayPal sandbox checkout, disputes, and APIs |
| AI | An OpenAI-compatible model proposes a plan, subject to the merchant's rules |
| Evidence | Available PayPal and demo order information, including simulated tracking |
| Shipping | Simulated events and controls; no real carrier connection |

## Current limits

- Signoff currently works with its demo shop. Connecting a real ecommerce shop is future work.
- The demo uses one shared merchant account. Individual user accounts and production readiness are future work.
- The integration uses the PayPal sandbox, not live payments. A decision or refund depends on the dispute, available PayPal actions, and the merchant's configured limits.

## Run locally

With Docker and Compose installed, start the local demo from the repository root:

```bash
docker compose up --build -d
```

Open http://localhost:5173/app/demo. The local demo uses a PayPal stub and a fake LLM, rather than the hosted sandbox journey. For service details and additional setup instructions, see [signoff/README.md](signoff/README.md).

## Built with

- **PayPal developer platform:** Sandbox Orders for checkout, Disputes APIs for case handling, and verified webhooks for dispute updates.
- **AI:** An OpenAI-compatible model proposes dispute plans; the merchant's signing limits govern allowed actions. A read-only assistant answers questions about dispute data.
- **AG Grid and AG Studio:** The dispute table supports filtering and CSV export, and AG Studio provides the read-only assistant.
- **Render:** Hosts the demo application and its services.
- **Other tools:** FastAPI, PostgreSQL, React, TypeScript, and Docker.

## License

MIT. See [LICENSE](LICENSE).
