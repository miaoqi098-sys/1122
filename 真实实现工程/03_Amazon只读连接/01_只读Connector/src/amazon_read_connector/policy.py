from __future__ import annotations

from .models import AmazonApiFamily, ReadOperation


class WriteCapabilityForbidden(PermissionError):
    pass


SP_API_READ_OPERATIONS = {
    ReadOperation.SPAPI_CATALOG_GET_ITEM,
    ReadOperation.SPAPI_LISTINGS_GET_ITEM,
    ReadOperation.SPAPI_INVENTORY_GET_SUMMARIES,
}

ADS_API_READ_OPERATIONS = {
    ReadOperation.ADS_CAMPAIGNS_LIST,
    ReadOperation.ADS_AD_GROUPS_LIST,
    ReadOperation.ADS_KEYWORDS_LIST,
}

READ_ALLOWLIST = SP_API_READ_OPERATIONS | ADS_API_READ_OPERATIONS


def assert_read_only_operation(operation: ReadOperation) -> None:
    if operation not in READ_ALLOWLIST:
        raise WriteCapabilityForbidden(f"operation is not in read-only allowlist: {operation}")


def api_family_for(operation: ReadOperation) -> AmazonApiFamily:
    assert_read_only_operation(operation)
    if operation in SP_API_READ_OPERATIONS:
        return AmazonApiFamily.SP_API
    if operation in ADS_API_READ_OPERATIONS:
        return AmazonApiFamily.ADS_API
    raise WriteCapabilityForbidden(f"operation has no read-only API family: {operation}")
