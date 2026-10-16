"""Grant the Meridian extraction Bot write access to a SharePoint site.

Prerequisites in Microsoft Entra for the app used to sign in interactively:
  1. Authentication -> Allow public client flows -> Yes
  2. Microsoft Graph delegated permission: Sites.FullControl.All
  3. Admin consent granted for that delegated permission

Run with a SharePoint Administrator or Global Administrator account:
  py grant_sharepoint_site.py --tenant-id <DIRECTORY_TENANT_ID> --admin-client-id <ADMIN_APP_CLIENT_ID> --site-path /sites/PowerBI9-PowerBI-PG

You can also run the script without arguments. It will securely prompt for the
tenant ID and app ID. No client secret is required. The same bot app receives
the site permission, so no separate target app ID is requested.

The admin app can be Meridian extraction Bot for this one-time setup. Remove its
delegated Sites.FullControl.All permission and disable public client flows after
the script succeeds. Keep its application Sites.Selected permission enabled.
"""

from __future__ import annotations

import argparse
import importlib.util
import json
import subprocess
import sys
import urllib.error
import urllib.parse
import urllib.request

GRAPH_ROOT = "https://graph.microsoft.com/v1.0"
SITE_HOSTNAME = "meridiangroupza.sharepoint.com"
DEFAULT_SITE_PATH = "/sites/MeridianNexus"
BOT_DISPLAY_NAME = "Meridian extraction Bot"


def load_msal():
    """Install MSAL for this user only when it is not already available."""
    if importlib.util.find_spec("msal") is None:
        print("Installing the required Microsoft authentication package for this user...")
        try:
            subprocess.check_call([
                sys.executable,
                "-m",
                "pip",
                "install",
                "--user",
                "msal",
            ])
        except subprocess.CalledProcessError as error:
            raise RuntimeError("Could not install the Microsoft authentication package. Ask IT to install Python pip access, then run the script again.") from error
    import msal
    return msal


def graph_request(access_token: str, method: str, path: str, body: dict | None = None) -> dict:
    data = json.dumps(body).encode("utf-8") if body is not None else None
    request = urllib.request.Request(
        f"{GRAPH_ROOT}{path}",
        data=data,
        method=method,
        headers={
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(request) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Microsoft Graph returned {error.code}: {detail}") from error


def app_id_for(permission: dict) -> str:
    identities = permission.get("grantedToIdentitiesV2") or permission.get("grantedToIdentities") or []
    for identity in identities:
        application = identity.get("application") or {}
        if application.get("id"):
            return application["id"]
    return ""


def main() -> None:
    parser = argparse.ArgumentParser(description="Grant a Microsoft Entra app write access to a SharePoint site.")
    parser.add_argument("--tenant-id", help="Microsoft Entra Directory (tenant) ID")
    parser.add_argument("--admin-client-id", help="Client ID of the Entra app configured for public-client device login")
    parser.add_argument("--target-app-id", help="Optional override for the app receiving the site permission")
    parser.add_argument("--site-path", default=DEFAULT_SITE_PATH, help=f"SharePoint site path, for example /sites/PowerBI9-PowerBI-PG (default: {DEFAULT_SITE_PATH})")
    args = parser.parse_args()

    tenant_id = args.tenant_id or input("Microsoft Entra Directory (tenant) ID: ").strip()
    admin_client_id = args.admin_client_id or input("Meridian extraction Bot Application (client) ID: ").strip()
    target_app_id = args.target_app_id or admin_client_id
    if not tenant_id or not admin_client_id or not target_app_id:
        raise RuntimeError("Tenant ID and Application (client) ID are required.")
    site_path_value = args.site_path.strip().rstrip("/")
    if not site_path_value.startswith("/sites/") or "/" not in site_path_value[1:]:
        raise RuntimeError("Site path must use the format /sites/SiteName.")

    msal = load_msal()
    client = msal.PublicClientApplication(
        admin_client_id,
        authority=f"https://login.microsoftonline.com/{tenant_id}",
    )
    flow = client.initiate_device_flow(scopes=["https://graph.microsoft.com/Sites.FullControl.All"])
    if "user_code" not in flow:
        raise RuntimeError(f"Could not start Microsoft sign-in: {flow}")
    print(flow["message"])
    token_result = client.acquire_token_by_device_flow(flow)
    if "access_token" not in token_result:
        if token_result.get("error_codes") and 7000218 in token_result["error_codes"]:
            raise RuntimeError(
                "Device-code login is disabled for this app. In Entra ID, open Meridian extraction Bot -> "
                "Authentication -> Advanced settings -> Allow public client flows, set it to Yes, then run the script again."
            )
        raise RuntimeError(f"Microsoft sign-in failed: {token_result.get('error_description', token_result)}")

    token = token_result["access_token"]
    site_path = urllib.parse.quote(site_path_value, safe="/")
    site = graph_request(token, "GET", f"/sites/{SITE_HOSTNAME}:{site_path}?$select=id,webUrl")
    permissions = graph_request(token, "GET", f"/sites/{site['id']}/permissions").get("value", [])
    existing = next((item for item in permissions if app_id_for(item) == target_app_id), None)
    body = {
        "roles": ["write"],
        "grantedToIdentities": [{
            "application": {"id": target_app_id, "displayName": BOT_DISPLAY_NAME}
        }],
    }
    if existing:
        graph_request(token, "PATCH", f"/sites/{site['id']}/permissions/{existing['id']}", {"roles": ["write"]})
        print(f"Updated {BOT_DISPLAY_NAME} to Write on {site['webUrl']}.")
    else:
        graph_request(token, "POST", f"/sites/{site['id']}/permissions", body)
        print(f"Granted {BOT_DISPLAY_NAME} Write access to {site['webUrl']}.")


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"Failed: {error}", file=sys.stderr)
        raise SystemExit(1)
