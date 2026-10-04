from analysis.research_discover import parse_public_page


def test_parses_public_message_without_following_paid_link():
    html = """
    <div class="tgme_widget_message" data-post="HS_academy/12345">
      <div class="tgme_widget_message_text js-message_text" dir="auto">
        오늘의 모닝효<br>AI와 반도체 이야기
        <a href="https://contents.premium.naver.com/hsacademy/hsacademy1/contents/261003083419860vz">프리미엄 글</a>
      </div>
      <time datetime="2026-10-03T00:34:19+00:00"></time>
    </div>"""
    rows = parse_public_page(html)
    assert len(rows) == 1
    row = rows[0]
    assert row["external_id"] == "12345"
    assert row["title"] == "오늘의 모닝효"
    assert row["linked_type"] == "naver_premium"
    assert row["linked_url"].endswith("261003083419860vz")
    assert row["source_url"] == "https://t.me/HS_academy/12345"
    assert len(row["fingerprint"]) == 64


def test_ignores_empty_messages_and_prefers_naver_over_youtube():
    html = """
    <div class="tgme_widget_message" data-post="HS_academy/1"><div class="tgme_widget_message_text"></div></div>
    <div class="tgme_widget_message" data-post="HS_academy/2">
      <div class="tgme_widget_message_text">나잇효
        <a href="https://youtube.com/watch?v=x">영상</a>
        <a href="https://naver.me/abc">글</a>
      </div>
    </div>"""
    rows = parse_public_page(html)
    assert [r["external_id"] for r in rows] == ["2"]
    assert rows[0]["linked_type"] == "naver"
    assert rows[0]["linked_url"] == "https://naver.me/abc"
