import { type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import Logo from "@/components/Logo";

/** Shared shell for the Privacy Policy and Terms pages. */
const LegalLayout = ({ title, updated, children }: { title: string; updated: string; children: ReactNode }) => (
  <div className="wood-bg min-h-screen px-4 py-10">
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="flex items-center justify-between gap-3">
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm font-bold text-[hsl(35,30%,66%)] hover:text-[hsl(42,88%,62%)]">
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
        <Logo className="h-10 w-auto" />
      </div>

      <div className="game-panel space-y-4 p-6 sm:p-8">
        <div>
          <h1 className="font-display text-3xl font-bold text-card-foreground">{title}</h1>
          <p className="mt-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">Last updated: {updated}</p>
        </div>

        <div className="space-y-3 text-sm leading-relaxed text-muted-foreground [&_a]:text-[hsl(178,52%,34%)] [&_a]:underline [&_h2]:mt-6 [&_h2]:font-display [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-card-foreground [&_strong]:text-card-foreground [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5">
          {children}
        </div>
      </div>
    </div>
  </div>
);

export default LegalLayout;
