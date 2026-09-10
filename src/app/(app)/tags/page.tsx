import { getAuthedUser } from "@/lib/auth";
import { listTagsForUser } from "@/lib/tags";
import { TagsView } from "@/components/tags/TagsView";

export default async function TagsPage() {
  const user = await getAuthedUser();
  const tags = await listTagsForUser(user.id);
  return <TagsView tags={tags} />;
}
