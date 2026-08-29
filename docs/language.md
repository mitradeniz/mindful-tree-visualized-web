# `.mtree` language

BranchScript documents use a small data language. The file extension is `.mtree`. Hierarchical views use two-space indentation, while graph views use explicit connections.

## Document

```text
diagram interview "Software engineering interview"
@view tree
```

The `tree` and `diagram` declarations are equivalent document headers. A declaration is optional; when present, it must be unindented and may appear once.

## Views

Set the visual language with one unindented `@view` attribute.

| View | Best suited for | Layout |
| --- | --- | --- |
| `tree` | Interview answers, follow-ups, thought branches | Top to bottom |
| `flow` | Processes and repeatable sequences | Left to right or top to bottom |
| `neural` | Layered inputs, signals, and outputs | Left to right |
| `logic` | Conditions, alternatives, and outcomes | Top to bottom |
| `algorithm` | Pseudocode, loops, conditions, and returns | Top to bottom |
| `data` | Arrays, stacks, queues, records, and references | Left to right |

If `@view` is omitted, BranchScript uses `tree`.

## Nodes

```text
question introduction "Tell me about yourself."
  response concise "Start with recent backend work and its impact."
    followup ownership "What did you own in that project?"
      response architecture "Explain the service boundaries and trade-offs."
      example latency "Mention the measured latency reduction."
    note metrics "Keep the answer measurable and under two minutes."
```

Every node has a keyword, a stable identifier, and quoted text.

| Keyword | Purpose |
| --- | --- |
| `topic` | Groups related questions |
| `question` | A prompt that may be asked |
| `response` | A response path you may choose |
| `followup` | A likely question after a response |
| `note` | A private reminder |
| `text` | A free text block for headings, explanations, and canvas notes |
| `example` | Evidence or a concrete story to mention |
| `input` | The beginning or input of a graph |
| `layer` | A named grouping or transformation stage |
| `neuron` | A signal-processing node in a neural view |
| `process` | An action or process step |
| `decision` | A condition with alternative branches |
| `outcome` | A terminal result |
| `output` | An output produced by a graph |
| `start` | The entry point of an algorithm |
| `function` | A pseudocode function or procedure |
| `operation` | An assignment or transformation |
| `condition` | A branch condition in an algorithm |
| `loop` | An iteration step |
| `return` | A returned value or terminal algorithm result |
| `array` | An indexed data container |
| `item` | A value or indexed element |
| `stack` | A last-in, first-out structure |
| `queue` | A first-in, first-out structure |
| `list` | A linked sequence |
| `record` | A structured value or linked node |
| `pointer` | A reference between values |

The following short forms keep fast scripts readable:

| Short form | Compiles as |
| --- | --- |
| `step` | `process` |
| `choice` | `decision` |
| `result` | `outcome` |

Indented thought trees start with `topic` or `question`. Explicitly connected diagrams may use `input`, `layer`, `neuron`, `process`, `decision`, `outcome`, and `output` as top-level nodes.

## Attributes

Attributes are indented directly below their node.

```text
response primary "Lead with the production incident."
  @tag preferred behavioral
  @priority high
```

Supported priorities are `low`, `normal`, and `high`.

Visual and workflow attributes are optional:

```text
step prototype "Build a focused prototype"
  @category "Product delivery"
  @width wide
  @shape pill
  @status active
```

| Attribute | Values |
| --- | --- |
| `@color` | `green`, `blue`, `amber`, `purple`, `red`, `gray` |
| `@category` | Quoted category label, up to 60 characters |
| `@width` | `compact`, `normal`, `wide` |
| `@shape` | `card`, `pill`, `diamond`, `circle` |
| `@status` | `idea`, `active`, `done`, `blocked` |
| `@priority` | `low`, `normal`, `high` |
| `@tag` | One or more searchable tags |
| `@font` | `sans`, `serif`, `mono` |
| `@font-size` | An integer from `10` through `48` |
| `@font-weight` | `regular`, `medium`, `bold` |
| `@align` | `left`, `center`, `right` |

Categories create a visible badge and a deterministic color shared by every node with the same category. An explicit `@color` overrides the category color. Width presets change wrapping without changing the text itself:

```text
question project "Describe a difficult project."
  @category "Behavioral"
  @width wide
  response incident "Production incident"
    @category "Behavioral"
    @width wide
```

Use categories for a small number of meaningful groups—such as `Opening`, `Technical`, `Behavioral`, `Role fit`, and `Closing`. Use tags for detailed search terms; too many visual categories reduce rather than improve readability.

Free text blocks can act as headings or annotations without looking like workflow steps:

```text
text reminder "Pause before answering"
  @text "Take one breath, then lead with the result."
  @font serif
  @font-size 28
  @font-weight bold
  @align center
```

Content attributes keep the node title short while placing useful material inside the box:

```text
question ownership "What did you own?"
  @text "Separate personal responsibility from the team's shared work."
  @answer "I owned the API contract, rollout plan, and production dashboards."
  @feature "Follow-up cue: explain one trade-off"
```

| Attribute | Purpose |
| --- | --- |
| `@text` | Context, explanation, pseudocode detail, signal, or stored value |
| `@answer` | Recall-ready interview answer highlighted in the node and Live Run |
| `@feature` | View-specific property such as a follow-up cue, result, activation, rule, complexity, or operation |
| `@items` | Data cells for an `array`, `stack`, `queue`, or `list`; separate values with `|` |
| `@fields` | Named fields for a `record`; separate fields with `|` |

The `@feature` caption follows the active view:

| View | Feature meaning |
| --- | --- |
| `tree` | Follow-up cue |
| `flow` | Expected result |
| `neural` | Activation or signal strength |
| `logic` | Branch rule |
| `algorithm` | Complexity or invariant |
| `data` | Operation, index, address, or reference |

## References

A reference connects the current node to an existing node without duplicating it.

```text
response fallback "Use the teamwork example."
  -> shared_followup
```

References may point forward or backward but cannot create cycles.

## Connections

Use `connect` for diagrams whose nodes are declared independently. An optional quoted label describes the transition.

```text
diagram answer_logic "Response Selection Logic"
@view logic

input prompt "Incoming question"
decision has_example "Do I have a strong real example?"
process answer "Answer with the STAR structure"
outcome fallback "Give a concise fallback answer"

connect prompt -> has_example
connect has_example -> answer "yes"
connect has_example -> fallback "no"
```

Connections may form loops in `flow`, `logic`, `algorithm`, and `data` views. `tree` and `neural` views must remain acyclic so their hierarchy and layers stay unambiguous.

## Algorithm example

```text
diagram search "Binary Search"
@view algorithm

start begin "sorted values and target"
operation bounds "low = 0; high = length - 1"
condition remaining "low <= high?"
return missing "return -1"

connect begin -> bounds
connect bounds -> remaining
connect remaining -> missing "no"
```

## Data structure example

```text
diagram structures "Data Structures"
@view data

array scores "Scores"
  @items "8 | 3 | 5 | 1"
  @feature "Access: O(1) by index"

stack undo "Undo stack"
  @items "edit-3 | edit-2 | edit-1"

queue jobs "Render queue"
  @items "parse | layout | render"

list chain "Linked list"
  @items "head | node_a | node_b | null"

record user "User record"
  @fields "id = 42 | name = Ada | role = engineer"

pointer next "next → node_b"
  @feature "Reference: node_b"

connect chain -> next "follow reference"
connect user -> next "related pointer"
```

`@items` creates visible cells. The same attribute works for horizontal arrays, FIFO queues, linked-list values, and vertical LIFO stacks. `@fields` creates rows inside a record. Use `pointer` nodes and labelled `connect` statements when you want to show an address or reference between structures.

For a quick structure, the label can still contain values such as `front: A · B · C` or `[8, 3, 5]`; BranchScript turns those separators into cells when `@items` is omitted. Prefer the explicit attributes when the diagram will be edited or shared.

## Comments

```text
# This line is ignored.
```

Comments and blank lines do not affect indentation.

## Rules

- Use spaces, not tabs.
- Add exactly two spaces for each child level.
- Identifiers begin with an ASCII letter and may contain letters, digits, `_`, or `-`.
- Identifiers must be unique within a document.
- Text is UTF-8 and must be enclosed in double quotes.
- `connect` source and target identifiers must exist in the same document.
- Scripts are parsed as data and never executed as JavaScript.

## Visual builder

The Add panel creates the same declarations, attributes, and `connect` statements described above. The visual builder does not introduce a second document format, so every visually created box remains editable as plain `.mtree` source.
