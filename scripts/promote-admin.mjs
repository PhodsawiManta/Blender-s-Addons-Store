const email = process.argv[2]?.trim().toLowerCase();
if (!email || !email.includes("@") || email.length > 320) {
  console.error("Usage: node scripts/promote-admin.mjs owner@example.com");
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceRoleKey) {
  console.error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  process.exit(1);
}

const headers = {
  apikey: serviceRoleKey,
  Authorization: `Bearer ${serviceRoleKey}`,
  "Content-Type": "application/json"
};

const profileUrl = new URL("/rest/v1/profiles", url);
profileUrl.searchParams.set("select", "id,email,role");
profileUrl.searchParams.set("email", `eq.${email}`);
profileUrl.searchParams.set("limit", "2");

const profileResponse = await fetch(profileUrl, { headers });
if (!profileResponse.ok) {
  console.error(`Unable to find the profile: HTTP ${profileResponse.status}`);
  process.exit(1);
}

const profiles = await profileResponse.json();
if (!Array.isArray(profiles) || profiles.length !== 1) {
  console.error(
    Array.isArray(profiles) && profiles.length === 0
      ? `No profile exists for ${email}. Sign in once before promoting it.`
      : `The profile lookup for ${email} was not unique; no account was changed.`
  );
  process.exit(1);
}

const profile = profiles[0];
const updateUrl = new URL("/rest/v1/profiles", url);
updateUrl.searchParams.set("id", `eq.${profile.id}`);
updateUrl.searchParams.set("email", `eq.${profile.email}`);

const updateResponse = await fetch(updateUrl, {
  method: "PATCH",
  headers: {
    ...headers,
    Prefer: "return=representation"
  },
  body: JSON.stringify({
    role: "admin",
    updated_at: new Date().toISOString()
  })
});

if (!updateResponse.ok) {
  console.error(`Unable to promote the profile: HTTP ${updateResponse.status}`);
  process.exit(1);
}

const updatedProfiles = await updateResponse.json();
if (
  !Array.isArray(updatedProfiles)
  || updatedProfiles.length !== 1
  || updatedProfiles[0]?.role !== "admin"
) {
  console.error("Unable to verify administrator access; no success was reported.");
  process.exit(1);
}

console.log(`Administrator access granted to ${updatedProfiles[0].email}.`);
