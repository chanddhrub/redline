# 01 — Nobody has been asked to pay

Status: decided 2026-09-06 — build first, validate later. The PRD was written
before anyone was asked to pay, and building starts on the same footing. The
willingness-to-pay gap stays open, deliberately and on the record; a working
v1 becomes the thing those ten conversations react to.

`research/summary.md` §5 is blunt: the pain is well-sourced, the *purchase* is
not. Across four research passes there is zero direct willingness-to-pay
evidence — not one sourced "I would pay $X to have my contract read". Every
price in the research is what someone pays a lawyer, or what a vendor lists.
The verdict names the next step as roughly ten conversations with people in one
segment plus a price test, explicitly *not* writing the PRD.

On 2026-08-28 we did the opposite: five product decisions (ADRs 0002–0005), a
glossary, and a brief about to be written. Every one of those decisions
improved the product. None of them touched the assumption the research calls
the riskiest.

This is recorded because the choice was made in passing rather than
deliberately. It was raised twice in that session and not answered, and a
decision nobody made is the kind that quietly becomes permanent.

The open question is not "is the product good". It is: **does the PRD get
written before or after ten job seekers have been asked what they would pay?**

Both orders are defensible:

- **PRD first.** The five decisions give those ten people something concrete to
  react to, which beats asking about a hypothetical. Cost: sunk effort and
  attachment to a shape nobody validated.
- **Interviews first.** Answers the riskiest assumption while the product is
  still cheap to change. Cost: the conversations are vaguer, and ADR 0002's
  wedge (job seekers) is itself an untested guess about who to talk to.

Note that §5.2 sharpens this: people who skip reading a contract are
demonstrating *avoidance*, and avoidance does not imply they will pay someone
else to read it. That is the specific thing to test, not general interest.
