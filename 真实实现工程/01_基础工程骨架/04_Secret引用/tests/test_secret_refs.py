import pytest

from secrets_runtime.models import SecretRef
from secrets_runtime.provider import EnvironmentSecretProvider


def test_secret_value_is_masked_in_repr() -> None:
    ref = SecretRef(provider="environment", key="TEST_RUNTIME_SECRET", purpose="unit-test")
    secret = EnvironmentSecretProvider({"TEST_RUNTIME_SECRET": "dummy-not-real"}).resolve(ref)
    assert "dummy-not-real" not in repr(secret)
    assert secret.reveal_for_authorized_client() == "dummy-not-real"


def test_missing_secret_reference_does_not_echo_value() -> None:
    ref = SecretRef(provider="environment", key="MISSING_SECRET", purpose="unit-test")
    with pytest.raises(LookupError) as exc_info:
        EnvironmentSecretProvider({}).resolve(ref)
    assert "MISSING_SECRET" in str(exc_info.value)


def test_environment_provider_rejects_other_provider() -> None:
    # The test is about provider rejection, so the reference itself must first
    # satisfy the canonical SecretRef key contract.
    ref = SecretRef(provider="vault", key="AMAZON/SP-API/TEST", purpose="unit-test")
    with pytest.raises(ValueError):
        EnvironmentSecretProvider({}).resolve(ref)
