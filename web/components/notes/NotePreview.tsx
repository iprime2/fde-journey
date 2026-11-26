// Note and link under the title when a note exists and the editor is closed (design spec 4).
import { isHttpsUrl, notePreview } from "@/lib/notes";
import { ExternalLink } from "../ui";

export function NotePreview({ note, link }: { note: string; link: string }) {
  if (!note && !link) return null;
  return (
    <div className="type-small max-w-[34em] whitespace-pre-wrap text-muted [overflow-wrap:anywhere]">
      {note && <p>{notePreview(note)}</p>}
      {link && <p>{isHttpsUrl(link) ? <ExternalLink href={link}>{link}</ExternalLink> : link}</p>}
    </div>
  );
}
