<!-- LOVABLE:BEGIN -->

> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

<!-- LOVABLE:END -->

- Analysis transport must return JSON errors for API requests and sanitize HTML failures in the chat client; page-only HTML fallbacks must never enter the transcript.
- Keep export libraries dynamically loaded only on explicit export actions so analysis rendering is independent of PDF/Excel generation.
- Analysis progress tracks actual lifecycle phases; percentages within each phase are estimates and must stay below completion until the response finishes.
- Parse CSV previews in a browser worker and serialize with Papa.unparse to preserve quoting without blocking interaction.
- Reserve report downloads for verified Pro subscriptions and share upload limits through billing constants to keep plan rules consistent.
- Keep the detailed Pro offer on its own public route with factual retention and sampling disclosures so sales copy matches product behavior.
