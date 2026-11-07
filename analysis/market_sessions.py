"""Latest fully closed exchange sessions; never turn an intraday bar into a close."""
import argparse
import datetime as dt
import json


def completed_session(calendar, now):
    now = now.astimezone(dt.timezone.utc)
    sessions = calendar.sessions_in_range((now - dt.timedelta(days=20)).date(), now.date())
    closed = [s for s in sessions if calendar.session_close(s).to_pydatetime() <= now]
    if not closed:
        raise ValueError('No completed exchange session in the last 20 days')
    return closed[-1].date().isoformat()


def main():
    import exchange_calendars as xcals
    parser = argparse.ArgumentParser()
    parser.add_argument('--market', choices=['ALL', 'KR', 'US'], default='ALL')
    args = parser.parse_args()
    now = dt.datetime.now(dt.timezone.utc)
    markets = ['KR', 'US'] if args.market == 'ALL' else [args.market]
    print(json.dumps({m: completed_session(xcals.get_calendar('XKRX' if m == 'KR' else 'XNYS'), now) for m in markets}))


if __name__ == '__main__':
    main()
