---
name: pqc-decompose
description: Use for Pepper Position Growth NEW engine operating profit price, quantity and cost decomposition from filings or industry KPI proxies.
---

Read `docs/harness/POSITION_GROWTH.md`. In code, reconcile opening and closing operating profit and decompose ΔOP into ΔP × Q0 + P1 × ΔQ − ΔC only when P and Q are supported by compatible quantities, units, reporting windows and cited source documents. Preserve interaction in the stated P1 × ΔQ convention. When no compatible P/Q exists, report Δrevenue − Δcost, label it as a two-part decomposition, and do not invent price/volume contributions. Mark extracted proxies and unverified inputs explicitly; AI supplies citations and prose, never numerical decomposition. Test the component sum against ΔOP within a documented rounding tolerance.
