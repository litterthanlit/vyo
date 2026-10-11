import { auth, currentUser } from "@clerk/nextjs/server";

// The signed-in person, in the shape the pages expect. Clerk keeps the accounts; Pantry only asks who is here.
export async function getSession() {
  const { userId } = await auth();
  if (!userId) return null;
  const user = await currentUser();
  return {
    user: { id: userId, email: user?.emailAddresses[0]?.emailAddress ?? null, name: user?.fullName ?? null },
  };
}
