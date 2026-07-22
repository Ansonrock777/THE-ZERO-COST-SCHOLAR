from rate_limit import SlidingWindowRateLimiter


def test_rate_limiter_releases_expired_requests():
    limiter = SlidingWindowRateLimiter(2, window_seconds=60)
    assert limiter.allow("user", now=0)
    assert limiter.allow("user", now=1)
    assert not limiter.allow("user", now=2)
    assert limiter.allow("user", now=61)


def test_rate_limiter_is_scoped_by_identifier():
    limiter = SlidingWindowRateLimiter(1)
    assert limiter.allow("one", now=0)
    assert limiter.allow("two", now=0)
