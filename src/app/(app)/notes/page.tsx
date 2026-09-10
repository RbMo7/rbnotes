import { redirect } from "next/navigation";

/** Bare `/notes` has no buffer to show -- the Dashboard at `/` is the landing screen now. */
export default function NotesIndexPage() {
  redirect("/");
}
