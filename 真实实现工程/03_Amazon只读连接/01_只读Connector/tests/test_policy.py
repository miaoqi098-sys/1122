import pytest

from amazon_read_connector import (
    AmazonApiFamily,
    READ_ALLOWLIST,
    ReadOperation,
    RetryPolicy,
    api_family_for,
)


def test_read_allowlist_contains_only_declared_read_operations() -> None:
    assert READ_ALLOWLIST == set(ReadOperation)


def test_spapi_operation_maps_to_sp_api() -> None:
    assert api_family_for(ReadOperation.SPAPI_CATALOG_GET_ITEM) is AmazonApiFamily.SP_API


def test_ads_operation_maps_to_ads_api() -> None:
    assert api_family_for(ReadOperation.ADS_CAMPAIGNS_LIST) is AmazonApiFamily.ADS_API


def test_retry_policy_rejects_zero_attempts() -> None:
    with pytest.raises(ValueError):
        RetryPolicy(max_attempts=0)


def test_retry_policy_caps_attempts() -> None:
    with pytest.raises(ValueError):
        RetryPolicy(max_attempts=6)
