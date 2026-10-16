"use strict";

function adminUserSaveError(error, HttpsError, savedUid = "") {
  if (error instanceof HttpsError) return error;
  const mapped = {
    "auth/email-already-exists": ["already-exists", "That email already has an account. Select the existing user to edit it; do not create it again."],
    "auth/invalid-email": ["invalid-argument", "Enter a valid email address."],
    "auth/invalid-password": ["invalid-argument", "The password must contain at least six characters."],
    "auth/password-does-not-meet-requirements": ["invalid-argument", "The password does not meet the project's password policy. Choose a stronger password."],
    "auth/user-not-found": ["not-found", "This account no longer exists. Refresh the user list before saving."],
    "auth/insufficient-permission": ["failed-precondition", "Nexus cannot manage authentication accounts. An administrator must check the function's Authentication permissions."],
    "auth/too-many-requests": ["resource-exhausted", "Too many account changes. Wait a moment and try again."]
  }[error?.code];
  if (savedUid) return new HttpsError("unavailable", "The sign-in account was saved, but its Nexus access could not be fully saved. Review this account and save again to finish.", { savedUid, incomplete: true });
  return new HttpsError(...(mapped || ["internal", "Nexus could not save this user. Try again; contact support if it continues."]));
}

module.exports = { adminUserSaveError };
