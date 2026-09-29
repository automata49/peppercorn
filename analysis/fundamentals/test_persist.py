"""Offline tests for persist.py: row building, idempotency keys, the write-target gate and the HTTP client."""
import copy
import json

import pytest

import methods
import persist


def _result(market="US", source="SEC", currency="USD", filed="2026-08-26", accession="0001-26-000075"):
    ends = ["2026-04-26", "2026-07-26"]
    quarters = {e: {"revenue": 100.0, "capex": 5.0, "equity": 400.0} for e in ends}
    if market == "KR":
        quarters = {e: {"revenue": 100.0, "capex": 5.0, "equity": 400.0} for e in ends}
    key = "accession" if market == "US" else "receipt"
    lineage = {e: {f: {"operation": "direct", "inputs": [{"end": e, "value": quarters[e][f], "filed": filed,
                                                            key: accession, "raw_sha256": "a" * 64}]}
                   for f in quarters[e]} for e in ends}
    return {"ticker": "T", "market": market, "source": source, "currency": currency, "as_of": None,
            "methodology": methods.for_market(market), "quarters": quarters, "source_lineage": lineage,
            "raw_sha256": "b" * 64, "checks": [["freshness", True, "ok"], ["quarters", True, "8"]],
            "metrics": {"as_of": ends[-1], "roic": 0.3, "roic_method": methods.for_market(market)["roic"]["version"]}}


def test_write_gate_allows_only_policy_tables():
    for table in ("fundamentals_q", "position_snapshot"):
        assert persist.assert_position_write_target(table) == table
    for table in persist.POLICY["protected"] + ["arbitrary", "", None]:
        with pytest.raises(PermissionError, match="write denied"):
            persist.assert_position_write_target(table)


def test_fact_rows_carry_lineage_iso_dates_and_market_methods():
    rows, skipped = persist.fact_rows(_result())
    assert skipped == []
    reported = [r for r in rows if r["status"] == "reported"]
    assert {r["field"] for r in reported} == {"revenue", "capex", "equity"}
    assert all(r["source_filed_at"] == "2026-08-26" and r["lineage"]["inputs"] and r["scope"] == "consolidated"
               for r in reported)
    capex = next(r for r in reported if r["field"] == "capex")
    assert capex["method_version"] == "US-FCF-1" and capex["unit"] == "USD"
    assert next(r for r in reported if r["field"] == "revenue")["method_version"] == persist.EXTRACT_VERSION
    dart = persist.fact_rows(_result("KR", "DART", "KRW", filed="20260814", accession="20260814003699"))[0]
    assert {r["source_filed_at"] for r in dart if r["status"] == "reported"} == {"2026-08-14"}
    assert next(r for r in dart if r["field"] == "capex")["method_version"] == "KR-FCF-PPE-2"


def test_missing_fields_become_unknown_rows_never_zero():
    rows, _ = persist.fact_rows(_result("KR", "DART", "KRW", filed="20260814", accession="x"))
    unknown = [r for r in rows if r["status"] == "unknown"]
    assert unknown and all(r["value"] is None and r["unknown_reason"] and r["lineage"] == {} for r in unknown)
    sbc = next(r for r in unknown if r["field"] == "sbc")
    assert "not collected from DART" in sbc["unknown_reason"]
    shares = next(r for r in unknown if r["field"] == "diluted_shares")
    assert shares["unit"] == "shares"
    assert not any(r["status"] == "reported" and r["value"] == 0 for r in rows)


def test_input_hash_ignores_response_hash_but_tracks_filing_identity_and_amount():
    base = persist.fact_rows(_result())[0]
    rehash = _result()
    rehash["raw_sha256"] = "c" * 64
    for per_end in rehash["source_lineage"].values():
        for item in per_end.values():
            item["inputs"][0]["raw_sha256"] = "d" * 64
    assert [r["input_hash"] for r in persist.fact_rows(rehash)[0]] == [r["input_hash"] for r in base]
    amended = persist.fact_rows(_result(accession="0001-26-000099"))[0]
    assert {r["input_hash"] for r in amended if r["status"] == "reported"}.isdisjoint(
        {r["input_hash"] for r in base if r["status"] == "reported"})
    changed = _result()
    changed["quarters"]["2026-07-26"]["revenue"] = 101.0
    diff = [(a, b) for a, b in zip(base, persist.fact_rows(changed)[0]) if a["input_hash"] != b["input_hash"]]
    assert [(a["field"], a["period_end"]) for a, _ in diff] == [("revenue", "2026-07-26")]
    assert len({r["input_hash"] for r in base if r["period_end"] == "2026-07-26" and r["status"] == "reported"}) == 3


def test_facts_without_complete_lineage_are_skipped_and_reported():
    result = _result()
    del result["source_lineage"]["2026-07-26"]["equity"]
    result["source_lineage"]["2026-07-26"]["capex"]["inputs"][0]["filed"] = None
    rows, skipped = persist.fact_rows(result)
    assert len(skipped) == 2 and all("no complete filing lineage" in item for item in skipped)
    assert {item.split(":")[0] for item in skipped} == {"2026-07-26/capex", "2026-07-26/equity"}
    assert not any(r["period_end"] == "2026-07-26" and r["field"] in ("capex", "equity") and r["status"] == "reported" for r in rows)


def test_only_the_requested_number_of_newest_quarters_is_written():
    rows, _ = persist.fact_rows(_result(), quarters=1)
    assert {r["period_end"] for r in rows} == {"2026-07-26"}


def test_snapshot_status_follows_checks_and_never_has_labels():
    result = _result()
    ok = persist.snapshot_row(result, ["h1", "h2"], "2026-09-28")
    assert ok["status"] == "unavailable" and ok["rules_version"] == "uncalibrated" and ok["roic_method"] == "US-ROIC-2"
    assert all(ok[k] is None for k in ("type_label", "quality_label", "growth_label", "value_label")) and ok["label_reasons"] == {}
    result["checks"][1][1] = False
    assert persist.snapshot_row(result, ["h1", "h2"], "2026-09-28")["status"] == "check_failed"
    assert not {"score", "position_score", "composite_score", "total_score"} & set(ok["metrics"])
    other_day = persist.snapshot_row(_result(), ["h1", "h2"], "2026-09-29")
    assert other_day["input_hash"] == ok["input_hash"]
    changed = _result()
    changed["metrics"]["roic"] = 0.31
    assert persist.snapshot_row(changed, ["h1", "h2"], "2026-09-28")["input_hash"] != ok["input_hash"]
    changed = _result()
    changed["checks"][0][1] = False
    assert persist.snapshot_row(changed, ["h1", "h2"], "2026-09-28")["input_hash"] != ok["input_hash"]
    changed = _result()
    changed["checks"][0][2] = "65 days ago"
    assert persist.snapshot_row(changed, ["h1", "h2"], "2026-09-29")["input_hash"] == ok["input_hash"]
    assert persist.snapshot_row(_result(), ["h2", "h1"], "2026-09-28")["input_hash"] == ok["input_hash"]
    assert persist.snapshot_row({**_result(), "metrics": {}}, [], "2026-09-28") is None


def test_plan_refuses_error_results_and_historical_reconstructions():
    assert persist.plan({"ticker": "T", "error": "boom"}, 20, "2026-09-28")["refused"]
    assert "as_of" in persist.plan({**_result(), "as_of": "2025-08-27"}, 20, "2026-09-28")["refused"]
    assert "facts" in persist.plan(_result(), 20, "2026-09-28")


def test_plan_refuses_partial_lineage_and_unauditable_snapshots():
    missing = _result()
    del missing["source_lineage"]["2026-07-26"]["equity"]
    refused = persist.plan(missing, 20, "2026-09-28")
    assert "facts" not in refused and "2026-07-26/equity" in refused["refused"]
    missing = _result()
    for fields in missing["source_lineage"].values():
        for origin in fields.values():
            del origin["inputs"][0]["accession"]
    assert "lineage" in persist.plan(missing, 20, "2026-09-28")["refused"]
    missing = _result()
    del missing["raw_sha256"]
    for fields in missing["source_lineage"].values():
        for origin in fields.values():
            del origin["inputs"][0]["raw_sha256"]
    assert "lineage" in persist.plan(missing, 20, "2026-09-28")["refused"]
    for result in ({**_result(), "checks": []}, {**_result(), "metrics": {}}):
        assert "no auditable collector snapshot" in persist.plan(result, 20, "2026-09-28")["refused"]
    assert "positive" in persist.plan(_result(), 0, "2026-09-28")["refused"]
    assert "latest quarter" in persist.plan({**_result(), "quarters": {}}, 20, "2026-09-28")["refused"]
    mismatched = _result()
    mismatched["metrics"]["as_of"] = "2026-09-01"
    assert "latest quarter" in persist.plan(mismatched, 20, "2026-09-28")["refused"]


def test_plan_is_stable_across_daily_reruns_and_changes_for_an_amendment():
    baseline = persist.plan(_result(), 20, "2026-09-28")
    retry = persist.plan(_result(), 20, "2026-09-29")
    assert baseline["snapshot"]["input_hash"] == retry["snapshot"]["input_hash"]
    assert [f["input_hash"] for f in baseline["facts"]] == [f["input_hash"] for f in retry["facts"]]
    amendment = persist.plan(_result(accession="0001-26-000099"), 20, "2026-09-29")
    assert amendment["snapshot"]["input_hash"] != baseline["snapshot"]["input_hash"]
    changed_unknown = _result()
    changed_unknown["source"] = "SEC amendment"
    assert persist.plan(changed_unknown, 20, "2026-09-29")["snapshot"]["input_hash"] != baseline["snapshot"]["input_hash"]


class _Response:
    def __init__(self, status=200, body=None, text=""):
        self.status_code, self._body, self.text = status, body if body is not None else [], text

    def json(self):
        return self._body


def _client(monkeypatch, responses=None):
    calls = []
    queue = list(responses or [])

    def record(method):
        def call(url, **kwargs):
            calls.append((method, url, kwargs))
            return queue.pop(0) if queue else _Response()
        return call
    monkeypatch.setattr(persist.requests, "get", record("get"))
    monkeypatch.setattr(persist.requests, "post", record("post"))
    return persist.Client("https://proj.example.co/", "secret-jwt"), calls


def test_client_looks_up_one_instrument_and_inserts_idempotently_in_chunks(monkeypatch):
    client, calls = _client(monkeypatch, [_Response(body=[{"id": "uuid-1"}])])
    assert client.instrument_id("US", "NVDA") == "uuid-1"
    method, url, kwargs = calls[0]
    assert (method, url) == ("get", "https://proj.example.co/rest/v1/instruments")
    assert kwargs["params"] == {"market": "eq.US", "ticker": "eq.NVDA", "select": "id"}
    assert kwargs["headers"]["Authorization"] == "Bearer secret-jwt"
    rows = [{"n": i} for i in range(persist.CHUNK + 1)]
    assert client.insert("fundamentals_q", rows) == persist.CHUNK + 1
    posts = calls[1:]
    assert len(posts) == 2 and all(p[1] == "https://proj.example.co/rest/v1/fundamentals_q" for p in posts)
    assert posts[0][2]["params"] == {"on_conflict": "instrument_id,period_end,field,input_hash"}
    assert posts[0][2]["headers"]["Prefer"] == "resolution=ignore-duplicates,return=minimal"
    assert len(json.loads(posts[0][2]["data"])) == persist.CHUNK and len(json.loads(posts[1][2]["data"])) == 1


def test_client_refuses_other_tables_before_any_request_and_rejects_nan(monkeypatch):
    client, calls = _client(monkeypatch)
    for table in ("price_daily", "market_metrics", "stock_analyses", "anything"):
        with pytest.raises(PermissionError):
            client.insert(table, [{"a": 1}])
    with pytest.raises(ValueError):
        client.insert("fundamentals_q", [{"value": float("nan")}])
    assert calls == []


def test_client_errors_hide_the_token_and_missing_instruments_abort(monkeypatch):
    client, _ = _client(monkeypatch, [_Response(status=401, text="bad token secret-jwt rejected")])
    with pytest.raises(RuntimeError) as failure:
        client.insert("position_snapshot", [{"a": 1}])
    assert "secret-jwt" not in str(failure.value) and "HTTP 401" in str(failure.value)
    for found in ([], [{"id": "a"}, {"id": "b"}]):
        client, _ = _client(monkeypatch, [_Response(body=found)])
        with pytest.raises(RuntimeError, match="not found exactly once"):
            client.instrument_id("KR", "005930")


def test_apply_writes_facts_then_snapshot_with_the_resolved_instrument(monkeypatch):
    client, calls = _client(monkeypatch, [_Response(body=[{"id": "uuid-9"}])])
    planned = persist.plan(_result(), 20, "2026-09-28")
    counts = persist.apply(planned, client)
    assert counts["snapshots"] == 1 and counts["facts"] == len(planned["facts"])
    fact_body = json.loads(calls[1][2]["data"])
    assert {row["instrument_id"] for row in fact_body} == {"uuid-9"}
    assert calls[2][1].endswith("/position_snapshot") and json.loads(calls[2][2]["data"])[0]["instrument_id"] == "uuid-9"


def _write(tmp_path, result):
    (tmp_path / f"{result['ticker']}.json").write_text(json.dumps(result, ensure_ascii=False), encoding="utf-8")


def test_cli_dry_run_never_touches_the_network_and_apply_needs_credentials(monkeypatch, tmp_path, capsys):
    def boom(*a, **k):
        raise AssertionError("network used")
    monkeypatch.setattr(persist.requests, "get", boom)
    monkeypatch.setattr(persist.requests, "post", boom)
    _write(tmp_path, _result())
    monkeypatch.setattr("sys.argv", ["persist.py", str(tmp_path)])
    persist.main()
    assert "DRY RUN T:" in capsys.readouterr().out
    for name in ("POSITION_SUPABASE_URL", "POSITION_PIPELINE_JWT"):
        monkeypatch.delenv(name, raising=False)
    monkeypatch.setattr("sys.argv", ["persist.py", str(tmp_path), "--apply"])
    with pytest.raises(SystemExit, match="POSITION_PIPELINE_JWT"):
        persist.main()


def test_cli_exits_nonzero_when_a_result_is_refused(monkeypatch, tmp_path, capsys):
    _write(tmp_path, {**_result(), "as_of": "2025-08-27"})
    monkeypatch.setattr("sys.argv", ["persist.py", str(tmp_path)])
    with pytest.raises(SystemExit) as stop:
        persist.main()
    assert stop.value.code == 1 and "REFUSED T" in capsys.readouterr().out


def test_cli_rejects_empty_folder_and_nonpositive_quarters(monkeypatch, tmp_path, capsys):
    monkeypatch.setattr("sys.argv", ["persist.py", str(tmp_path)])
    with pytest.raises(SystemExit, match="No collector JSON results"):
        persist.main()
    monkeypatch.setattr("sys.argv", ["persist.py", str(tmp_path), "--quarters", "0"])
    with pytest.raises(SystemExit) as stop:
        persist.main()
    assert stop.value.code == 2 and "--quarters must be positive" in capsys.readouterr().err


@pytest.mark.parametrize("given", ["https://proj.example.co", "https://proj.example.co/rest/v1", " https://proj.example.co/rest/v1/ "])
def test_client_accepts_project_url_or_rest_endpoint(given):
    assert persist.Client(given, "t").url == "https://proj.example.co"
