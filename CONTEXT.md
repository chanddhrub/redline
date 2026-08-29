# Redline — Context

The vocabulary this project uses. Where a word here has a narrower meaning than
its everyday one, that narrowing is the point — it is what stops two sessions
building slightly different products.

## Who

**Wedge segment** — the single buyer v1 serves: **job seekers** reviewing an
offer letter, non-compete, or IP assignment before signing. Chosen in
[ADR 0002](docs/adr/0002-job-seekers-are-the-wedge.md).

**Crisis user** — the person Redline is designed for: facing one document, on a
deadline, with a decision to make now. Not a habitual user. This is why the
saved library is deferred rather than built.

**Not served in v1** — tenants. Named explicitly because they are harmed often
and have the least money to defend themselves; excluding them is a choice, not
an oversight.

## What the product handles

**Before-signature** — the moment Redline operates in. The document has not been
signed and the decision is still open. Harm that lands after signing
(auto-renewal, cancellation difficulty) is out of reach, and the research ranks
that harm #1 by evidence. We accept the gap rather than pretending to close it.

**Source sentence** — the exact sentence from the uploaded document that a flag
came from, shown verbatim. Not a paraphrase, not a clause reference, not a page
number. A flag without one is a bug ([ADR 0001](docs/adr/0001-every-flag-cites-its-source.md)).

**Flag** — one identified risk: a source sentence, a severity, a plain-English
statement of what it means, and a drafted counter-offer.

**Red line** — a constraint the user declares in advance ("I will not sign an
IP assignment covering personal projects"). Red lines drive the analysis rather
than decorating it.

**Counter-offer** — drafted replacement language for a flagged clause. Note that
the research found no evidence anyone wants this, and it assumes leverage many
users lack; it survives in v1 because an offer letter is one of the few
genuinely negotiable documents.

## How the analysis judges

**Escapability** — how hard a clause is to get out of: duration, breadth, cost
to exit. The primary severity axis; **money at stake** breaks ties
([ADR 0003](docs/adr/0003-severity-is-escapability-then-money.md)). Note that
*unusual* is not *dangerous* — a strange clause can be harmless.

**Promotion** — what a matching red line does to a flag: raises it to the top
and names the red line it crossed. Red lines never demote a flag below its
default severity.

**Coverage receipt** — what a clean document returns: the clause types checked,
the finding for each, and a plain statement of what was not reviewed. It exists
so "no flags" is never read as "safe to sign"
([ADR 0004](docs/adr/0004-output-posture.md)).

**Second layer** — enforceability information keyed to the user's state,
labelled as not coming from the document and kept visually distinct from cited
flags ([ADR 0005](docs/adr/0005-jurisdiction-is-a-labelled-second-layer.md)).
The flag layer still obeys ADR 0001 in full.

## Deferred, not deleted

**Library** — saved past documents. A retention feature; v1 has no acquisition
to retain. Revisit once the crisis user is proven to come back.
