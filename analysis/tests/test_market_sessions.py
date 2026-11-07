import datetime as dt
import unittest
import pandas as pd
from analysis.market_sessions import completed_session


class Calendar:
    def sessions_in_range(self, start, end):
        return pd.DatetimeIndex(['2026-11-05', '2026-11-06'])

    def session_close(self, session):
        return pd.Timestamp(str(session.date()) + 'T21:00:00Z')


class SessionTests(unittest.TestCase):
    def test_intraday_waits_for_the_close(self):
        self.assertEqual(completed_session(Calendar(), dt.datetime(2026, 11, 6, 20, tzinfo=dt.timezone.utc)), '2026-11-05')

    def test_close_and_weekend_use_completed_session(self):
        for day in [6, 7, 8]:
            self.assertEqual(completed_session(Calendar(), dt.datetime(2026, 11, day, 21, tzinfo=dt.timezone.utc)), '2026-11-06')
