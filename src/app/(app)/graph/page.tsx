import { getAuthedUser } from "@/lib/auth";
import { buildNoteGraph } from "@/lib/graph";
import { GraphView } from "@/components/graph/GraphView";

export default async function GraphPage() {
  const user = await getAuthedUser();
  const graph = await buildNoteGraph(user.id);
  return <GraphView nodes={graph.nodes} edges={graph.edges} />;
}
