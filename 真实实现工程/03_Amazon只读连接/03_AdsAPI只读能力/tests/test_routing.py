import pytest

from amazon_read_connector import AmazonApiFamily, ReadOperation, TransportRequest
from ads_api_read import AdsProfile, AdsRegion, build_post_target


def _request(operation: ReadOperation) -> TransportRequest:
    return TransportRequest(
        api_family=AmazonApiFamily.ADS_API,
        operation=operation,
        seller_account_id="seller-1",
        marketplace_id="ATVPDKIKX0DER",
        params={"stateFilter": {"include": ["ENABLED"]}},
        correlation_id="corr-1",
        credential_ref_key="AMAZON/ADS/ACCESS_TOKEN",
    )


def _profile(region: AdsRegion = AdsRegion.NA) -> AdsProfile:
    return AdsProfile(
        profile_id="profile-1",
        seller_account_id="seller-1",
        marketplace_id="ATVPDKIKX0DER",
        region=region,
    )


@pytest.mark.parametrize(
    ("operation", "suffix", "media_type"),
    [
        (ReadOperation.ADS_CAMPAIGNS_LIST, "/sp/campaigns/list", "application/vnd.spCampaign.v3+json"),
        (ReadOperation.ADS_AD_GROUPS_LIST, "/sp/adGroups/list", "application/vnd.spAdGroup.v3+json"),
        (ReadOperation.ADS_KEYWORDS_LIST, "/sp/keywords/list", "application/vnd.spKeyword.v3+json"),
    ],
)
def test_build_post_target_maps_only_read_operations(operation, suffix, media_type):
    url, body, actual_media_type = build_post_target(_request(operation), _profile())

    assert url == f"https://advertising-api.amazon.com{suffix}"
    assert body == {"stateFilter": {"include": ["ENABLED"]}}
    assert actual_media_type == media_type


def test_build_post_target_uses_fixed_regional_hosts():
    url, _, _ = build_post_target(
        _request(ReadOperation.ADS_CAMPAIGNS_LIST),
        _profile(AdsRegion.FE),
    )
    assert url.startswith("https://advertising-api-fe.amazon.com/")


def test_build_post_target_rejects_profile_identity_mismatch():
    profile = AdsProfile(
        profile_id="profile-2",
        seller_account_id="other-seller",
        marketplace_id="ATVPDKIKX0DER",
        region=AdsRegion.NA,
    )

    with pytest.raises(ValueError, match="seller"):
        build_post_target(_request(ReadOperation.ADS_CAMPAIGNS_LIST), profile)


def test_build_post_target_rejects_spapi_operation():
    request = TransportRequest(
        api_family=AmazonApiFamily.SP_API,
        operation=ReadOperation.SPAPI_CATALOG_GET_ITEM,
        seller_account_id="seller-1",
        marketplace_id="ATVPDKIKX0DER",
        resource_id="B000TEST",
        correlation_id="corr-1",
        credential_ref_key="AMAZON/ADS/ACCESS_TOKEN",
    )

    with pytest.raises(ValueError, match="Ads API read operation"):
        build_post_target(request, _profile())
