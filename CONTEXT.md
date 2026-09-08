# Audit reference glossary

Vocabulary for historical findings, retrieval, review assessment. See `ARCHITECTURE.md` for implementation details.

## Language

**Finding**:
One reported security-audit observation in the dataset, with a title, description, severity, and any supplied recommendation or proof of concept.
_Avoid_: report, row

**Candidate**:
A suspected finding in the current review whose applicability and impact require assessment.
_Avoid_: confirmed finding, historical finding

**Disposition**:
The recorded decision to retain, reject, merge, or leave a candidate unresolved, with supporting reasons.
_Avoid_: confidence score, silent omission

**Severity**:
A finding's normalized impact label: Critical, High, Medium, Low, Gas Optimization, Informational, Other, or Unknown. A historical label does not classify the current candidate.
_Avoid_: confidence, priority

**Raw severity**:
The severity text supplied by the dataset before normalization.
_Avoid_: original label

**Real PoC**:
The dataset profile's label for a proof of concept containing code rather than placeholder text. It does not mean the code was validated.
_Avoid_: valid PoC, working exploit

**Placeholder**:
Filler text standing in for missing content, such as "no poc" or "No recommendation".
_Avoid_: empty value, null

**Weight**:
The dataset's zero-to-one estimate of write-up thoroughness. It does not establish severity, relevance, or correctness.
_Avoid_: importance, priority

**Similar findings**:
Historical findings retrieved as potentially relevant reference material for a review. Their applicability remains to be assessed against the current source.
_Avoid_: confirmed matches, proof

**Index**:
The prepared collection of findings searched during reference lookup.
_Avoid_: knowledge, model memory

**Audit-reference MCP**:
Orbitl's interface for providing historical reference context to a review host.
_Avoid_: scanner, auditor, autonomous reviewer

**RAG**:
Retrieval-augmented generation, in which a model uses retrieved reference material as context for its response.
_Avoid_: built-in model, semantic search

**Citation**:
A stable reference to a finding within an identified dataset snapshot. It identifies a historical observation rather than evidence of a current defect.
_Avoid_: proof, source-code evidence

**Reference page**:
A bounded part of one finding's description or recommendation, read as one step in a longer reference lookup.
_Avoid_: complete report, PoC

**Host model**:
The model selected by the MCP client to assess supplied evidence and reference context. The audit-reference MCP does not select or call it.
_Avoid_: Orbitl model, retrieval engine

**Lexical score**:
A ranking value based on how query terms occur in indexed text. It has no interpretation as a probability or confidence in a candidate.
_Avoid_: confidence score, safety score

**Embedding**:
A representation of text used for semantic similarity search.
_Avoid_: vector without qualification
