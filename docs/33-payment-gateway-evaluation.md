# 33 — Payment Gateway Evaluation (Indonesia)

**Checked:** 2026-11-14, from the official public pricing pages listed below (raw page text retrieved by the agent). Prices change — **re-check immediately before onboarding**. No account was created, no onboarding started, no cost incurred. Billing in SANDAR remains **OFF**.

## Sources (official)
- Midtrans: https://midtrans.com/id/biaya
- Xendit: https://www.xendit.co/id/biaya/
- Duitku: https://www.duitku.com/harga/
- Faspay: https://faspay.co.id/id/harga/

## Published per-transaction fees (as read on 2026-11-14)

| Item | Midtrans | Xendit | Duitku | Faspay |
|---|---|---|---|---|
| Setup / monthly fee | "No implementation or maintenance fee" (Midtrans docs) | Pay-as-you-go (no setup fee shown on pricing page) | "tidak memungut biaya registrasi ataupun biaya perawatan" (homepage FAQ) | Registration free (homepage FAQ); subscription dashboards for some products are paid |
| QRIS | 0.7% (VAT **included**) | 0.70% (incl. PPN, for tx > IDR 100,000) **+ Xendit Processing Fee IDR 4,000** | 0.7% | Listed; rate not captured in page text — **unconfirmed** |
| Virtual Account | IDR 4,000 (BCA, BNI, Mandiri, Permata, BRI, CIMB, Danamon, BSI, SeaBank, Saqu) | IDR 9,000 + IDR 4,000 processing | Artha Graha/Sampoerna 1,500; Mandiri 4,000; BCA 5,000; others 3,000 | IDR 4,000 |
| GoPay | 2% (VAT incl.) | 3.00% non-digital / **5.00% digital** + 4,000 | — (via QRIS) | — |
| ShopeePay | 2% (VAT incl.) | 2.50% retail / **3.60% digital** + 4,000 | 2% / **4% digital** | 2% |
| OVO / DANA | 1.5% / 1.5% | OVO 3.00% non-digital / **5.50% digital**; DANA 3.00% + 4,000 | 1.67% (OVO digital 3.03%) | 1.5% |
| Card | 2.9% + IDR 2,000 | 2.90% + IDR 2,000 + 4,000 | 2.9% + IDR 2,500 | Listed (rate not captured) |
| Retail (Indomaret/Alfamart) | IDR 5,000 | IDR 9,000 + 4,000 | Indomaret MDR+1,000; Alfamart 2,500 | IDR 5,000 |
| VAT note | All fees excl. PPN **except** QRIS, GoPay, ShopeePay | QRIS shown "termasuk PPN"; others not stated | Not stated — **verify** | "Daftar Harga belum termasuk PPN" |
| Gaming/digital surcharge | "Biaya berbeda untuk perusahaan gaming & produk digital" | Separate "digital" rates for e-wallets | Separate "digital" rates | Not stated |

**Important:** SANDAR is a *digital service / SaaS*. Several providers price "digital" merchants higher. Category classification must be confirmed with each provider during onboarding.

## Illustrative net revenue per Plus Monthly (Rp29.000), before tax & refunds
| Method | Midtrans | Xendit | Duitku |
|---|---|---|---|
| QRIS | 29,000 − 203 = **28,797** | 29,000 − 203 − 4,000 ≈ **24,797** (and 0.7% "incl. PPN" applies to > 100k; < 100k rate **unconfirmed**) | 29,000 − 203 = **28,797** |
| VA (BCA) | 29,000 − 4,000 (+PPN) ≈ **24,560** | 29,000 − 13,000 = **16,000** | 29,000 − 5,000 = **24,000** (+PPN?) |

Annual (Rp290.000) amortizes fixed VA fees much better (e.g. Midtrans VA ≈ 1.5%).

## Recurring / subscription support (needs confirmation)
- Midtrans: pricing page mentions "pembayaran berkala / berulang" — exact methods and terms **unconfirmed**.
- Xendit: recurring/subscriptions exist in product docs — **unconfirmed** for each IDR method.
- Duitku / Faspay: **unconfirmed**.
QRIS and VA are typically one-off; true auto-renewal usually requires card tokenization or e-wallet autodebit. MVP recommendation: **no auto-renew**; user pays per period, with renewal reminder and transparent expiry.

## Missing / uncertain facts (must verify before onboarding)
Settlement timing and fees, payout/withdrawal fees, reserves, refund and chargeback fees, minimum transaction, required legal documents (individual vs. PT/CV, NIB, NPWP), SaaS/digital category acceptance, exact VAT treatment per method, Faspay QRIS and card rates.

## Recommendation (provisional)
1. **Primary candidate: Midtrans** — no setup/maintenance fee, lowest published QRIS (0.7% VAT-inclusive) and VA (IDR 4,000), webhook signature scheme already implemented (`MidtransGateway.verifyWebhook`, SHA-512).
2. **Alternative: Duitku** — comparable QRIS, cheaper VA on some banks.
3. Xendit's additional IDR 4,000 processing fee makes it expensive at a Rp29.000 price point.
4. Launch with **QRIS + annual plan emphasis** to minimise fixed per-transaction fees.

Owner actions before any activation: choose provider, complete KYC with own legal documents, confirm category and VAT, provide sandbox keys as Cloudflare secrets, approve live activation explicitly.
