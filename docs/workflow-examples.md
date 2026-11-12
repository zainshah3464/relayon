# Workflow Examples

## Stripe checkout → Slack
- Source: Stripe
- Secret: from Stripe Dashboard → Webhooks → signing secret
- Destination: Slack incoming webhook
- AI enrichment: ON (summary + classification)

## GitHub PR → Google Sheets
- Source: GitHub
- Secret: from repo Settings → Webhooks
- Destination: Google Sheets (share spreadsheet with service account email)
- Transform: extract PR number, author, action

## Shopify order → Email
- Source: Shopify
- Destination: Email (Resend)
- Transform: `{ 'order': id, 'total': total_price, 'customer': customer.email }`