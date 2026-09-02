import type { DiagramView, GraphDocument, NodeKind, NodeShape } from "../domain/graph-document";

export interface ShapePalettePreset {
  id: string;
  shape: NodeShape;
  kind: NodeKind;
  name: string;
  shapeName: string;
  label: string;
  text?: string;
  feature?: string;
  items?: readonly string[];
  fields?: readonly string[];
  keepNativeShape?: boolean;
}

const treePalette: readonly ShapePalettePreset[] = [
  { id: "tree-root", shape: "pill", kind: "topic", name: "Root", shapeName: "Main topic", label: "Root topic", text: "The top-level subject that all branches explain.", feature: "Tree level: 0" },
  { id: "tree-branch", shape: "diamond", kind: "question", name: "Branch", shapeName: "Decision path", label: "New branch", text: "Split the topic into a meaningful sub-question or category.", feature: "Tree role: branch" },
  { id: "tree-child", shape: "card", kind: "followup", name: "Child", shapeName: "Subtopic", label: "New child node", text: "A direct child that adds one level of detail.", feature: "Tree role: child" },
  { id: "tree-leaf", shape: "circle", kind: "response", name: "Leaf", shapeName: "Terminal node", label: "New leaf", text: "A final answer or value with no required child branch.", feature: "Tree role: leaf" },
  { id: "tree-question", shape: "pill", kind: "question", name: "Question", shapeName: "Prompt", label: "New question", text: "A question whose possible answers become child branches." },
  { id: "tree-note", shape: "circle", kind: "note", name: "Note", shapeName: "Reminder", label: "New note", text: "Supporting context that does not change the hierarchy." },
  { id: "tree-text", shape: "card", kind: "text", name: "Text block", shapeName: "Heading", label: "New text block", text: "A visual heading used to group nearby branches." },
  { id: "tree-example", shape: "card", kind: "example", name: "Example", shapeName: "Evidence", label: "New example", text: "A concrete example attached to this part of the tree." },
];

export const shapePalettes: Readonly<Record<DiagramView, readonly ShapePalettePreset[]>> = {
  tree: treePalette,
  flow: [
    { id: "flow-start", shape: "pill", kind: "start", name: "Start", shapeName: "Entry", label: "Start flow", text: "The event or condition that starts the flow.", feature: "Flow: entry" },
    { id: "flow-input", shape: "pill", kind: "input", name: "Input", shapeName: "Data entry", label: "Read input", text: "Receive data or a user action before processing.", feature: "Flow: input" },
    { id: "flow-process", shape: "card", kind: "process", name: "Process", shapeName: "Action", label: "Run process", text: "Perform one clear action and pass its result forward.", feature: "Flow: process" },
    { id: "flow-decision", shape: "diamond", kind: "decision", name: "Decision", shapeName: "Yes / No", label: "Check condition", text: "Choose the next path according to a true or false condition.", feature: "Branches: yes / no" },
    { id: "flow-loop", shape: "diamond", kind: "loop", name: "Loop", shapeName: "Repeat path", label: "Repeat while", text: "Repeat connected steps while the condition remains true.", feature: "Flow: loop back" },
    { id: "flow-parallel", shape: "card", kind: "process", name: "Parallel", shapeName: "Concurrent steps", label: "Run in parallel", text: "Start independent branches that can run at the same time.", feature: "Flow: fork / join" },
    { id: "flow-output", shape: "pill", kind: "output", name: "Output", shapeName: "Data exit", label: "Write output", text: "Expose the value produced by the preceding steps.", feature: "Flow: output" },
    { id: "flow-end", shape: "circle", kind: "outcome", name: "End", shapeName: "Terminal", label: "End flow", text: "Stop the flow after its final result or state.", feature: "Flow: terminal" },
  ],
  neural: [
    { id: "neural-input", shape: "card", kind: "input", name: "Input", shapeName: "Feature vector", label: "Input features", text: "Normalized values presented to the network.", feature: "Tensor: batch × features" },
    { id: "neural-dense", shape: "pill", kind: "layer", name: "Dense layer", shapeName: "Fully connected", label: "Dense layer", text: "Every input contributes to every unit in this layer.", feature: "Layer: Wx + b" },
    { id: "neural-convolution", shape: "pill", kind: "layer", name: "Convolution", shapeName: "Feature extractor", label: "Convolution layer", text: "Learn local patterns with shared kernels.", feature: "Layer: convolution" },
    { id: "neural-neuron", shape: "circle", kind: "neuron", name: "Neuron", shapeName: "Unit", label: "Neuron", text: "Combine weighted inputs, bias and an activation function.", feature: "Unit: activation(Wx + b)" },
    { id: "neural-activation", shape: "diamond", kind: "layer", name: "Activation", shapeName: "Non-linearity", label: "Activation function", text: "Apply a non-linear transformation such as ReLU or sigmoid.", feature: "Activation: ReLU" },
    { id: "neural-output", shape: "pill", kind: "output", name: "Output", shapeName: "Prediction", label: "Model output", text: "Return the prediction, score or class distribution.", feature: "Output: prediction" },
  ],
  logic: [
    { id: "logic-input", shape: "pill", kind: "input", name: "Boolean input", shapeName: "True / False", label: "Boolean input", text: "A boolean signal supplied to a gate.", feature: "Value: true / false" },
    { id: "logic-and", shape: "card", kind: "process", name: "AND gate", shapeName: "A ∧ B", label: "AND gate", text: "True only when every input is true.", feature: "Gate: A ∧ B" },
    { id: "logic-or", shape: "card", kind: "process", name: "OR gate", shapeName: "A ∨ B", label: "OR gate", text: "True when at least one input is true.", feature: "Gate: A ∨ B" },
    { id: "logic-not", shape: "circle", kind: "process", name: "NOT gate", shapeName: "¬A", label: "NOT gate", text: "Invert the boolean input.", feature: "Gate: ¬A" },
    { id: "logic-xor", shape: "diamond", kind: "decision", name: "XOR gate", shapeName: "A ⊕ B", label: "XOR gate", text: "True when exactly one input is true.", feature: "Gate: A ⊕ B" },
    { id: "logic-nand", shape: "card", kind: "process", name: "NAND gate", shapeName: "¬(A ∧ B)", label: "NAND gate", text: "False only when every input is true.", feature: "Gate: ¬(A ∧ B)" },
    { id: "logic-nor", shape: "card", kind: "process", name: "NOR gate", shapeName: "¬(A ∨ B)", label: "NOR gate", text: "True only when every input is false.", feature: "Gate: ¬(A ∨ B)" },
    { id: "logic-output", shape: "pill", kind: "outcome", name: "Boolean output", shapeName: "Result", label: "Boolean output", text: "The final boolean result produced by the circuit.", feature: "Logic: output" },
  ],
  algorithm: [
    { id: "algorithm-start", shape: "pill", kind: "start", name: "Start", shapeName: "Entry", label: "Start algorithm", text: "Initialize the inputs and state required by the algorithm.", feature: "Algorithm: entry" },
    { id: "algorithm-function", shape: "card", kind: "function", name: "Function", shapeName: "Callable", label: "Define function", text: "Group reusable steps behind parameters and a return value.", feature: "Algorithm: function" },
    { id: "algorithm-operation", shape: "card", kind: "operation", name: "Operation", shapeName: "Instruction", label: "Run operation", text: "Perform one assignment, calculation or state update.", feature: "Algorithm: O(1) step" },
    { id: "algorithm-condition", shape: "diamond", kind: "condition", name: "If / else", shapeName: "Conditional", label: "Check if condition", text: "Choose between branches according to a boolean condition.", feature: "Branches: true / false" },
    { id: "algorithm-for", shape: "diamond", kind: "loop", name: "For loop", shapeName: "Counted loop", label: "For each item", text: "Repeat once for every item or index in a known range.", feature: "Loop: for each" },
    { id: "algorithm-while", shape: "diamond", kind: "loop", name: "While loop", shapeName: "Conditional loop", label: "While condition", text: "Repeat while a condition remains true.", feature: "Loop: while" },
    { id: "algorithm-recursion", shape: "card", kind: "function", name: "Recursion", shapeName: "Self call", label: "Recursive call", text: "Solve a smaller instance until the base case is reached.", feature: "Requires: base case" },
    { id: "algorithm-return", shape: "pill", kind: "return", name: "Return", shapeName: "Result", label: "Return result", text: "Finish the current function and send its result to the caller.", feature: "Algorithm: return" },
  ],
  data: [
    { id: "data-array", shape: "card", kind: "array", name: "Array", shapeName: "Indexed values", label: "Array", items: ["8", "3", "5", "1"], text: "Read or update a value by its numeric index.", feature: "Access: O(1)", keepNativeShape: true },
    { id: "data-stack", shape: "card", kind: "stack", name: "Stack", shapeName: "LIFO", label: "Stack", items: ["top", "item-2", "item-1"], text: "The most recently pushed item is removed first.", feature: "LIFO: push / pop", keepNativeShape: true },
    { id: "data-queue", shape: "card", kind: "queue", name: "Queue", shapeName: "FIFO", label: "Queue", items: ["front", "item-2", "rear"], text: "The earliest queued item is removed first.", feature: "FIFO: enqueue / dequeue", keepNativeShape: true },
    { id: "data-list", shape: "card", kind: "list", name: "Linked list", shapeName: "Linked nodes", label: "Linked list", items: ["head", "node", "tail"], text: "Each node stores a value and a link to the next node.", feature: "Traversal: O(n)", keepNativeShape: true },
    { id: "data-hash-map", shape: "diamond", kind: "record", name: "Hash map", shapeName: "Key → value", label: "Hash map", fields: ["name = Ada", "role = engineer", "level = senior"], text: "Hash a key to locate its associated value.", feature: "Average lookup: O(1)", keepNativeShape: true },
    { id: "data-min-heap", shape: "card", kind: "array", name: "Min heap", shapeName: "Priority tree", label: "Min heap", items: ["1", "3", "5", "8"], text: "Keep the smallest value at the root of a complete binary tree.", feature: "Insert / remove: O(log n)", keepNativeShape: true },
    { id: "data-binary-tree", shape: "diamond", kind: "record", name: "Binary tree", shapeName: "Left / right", label: "Binary tree node", fields: ["value = 8", "left = node_a", "right = node_b"], text: "Each node can reference a left child and a right child.", feature: "Traversal: DFS / BFS", keepNativeShape: true },
    { id: "data-set", shape: "card", kind: "array", name: "Set", shapeName: "Unique values", label: "Set", items: ["red", "green", "blue"], text: "Store each distinct value at most once.", feature: "Membership: average O(1)", keepNativeShape: true },
    { id: "data-graph", shape: "card", kind: "record", name: "Graph", shapeName: "Adjacency list", label: "Graph", fields: ["A = B, C", "B = D", "C = D"], text: "Represent vertices and their connecting edges.", feature: "Model: adjacency list", keepNativeShape: true },
    { id: "data-pointer", shape: "circle", kind: "pointer", name: "Pointer", shapeName: "Reference", label: "Pointer", text: "Store a reference to another value or node.", feature: "Reference: target address", keepNativeShape: true },
  ],
};

const native = (preset: Omit<ShapePalettePreset, "keepNativeShape">): ShapePalettePreset => ({
  ...preset,
  keepNativeShape: true,
});

export const dataShapePalettes: Partial<Record<NodeKind, readonly ShapePalettePreset[]>> = {
  array: [
    native({ id: "array-collection", shape: "card", kind: "array", name: "Array", shapeName: "Collection", label: "New array" }),
    native({ id: "array-element", shape: "pill", kind: "item", name: "Element", shapeName: "Array cell", label: "New element" }),
    native({ id: "array-index", shape: "circle", kind: "pointer", name: "Index", shapeName: "Index pointer", label: "New index" }),
    native({ id: "array-value", shape: "diamond", kind: "record", name: "Value", shapeName: "Stored value", label: "New value" }),
    native({ id: "array-slice", shape: "card", kind: "array", name: "Slice", shapeName: "Subarray", label: "New slice" }),
    native({ id: "array-lookup", shape: "circle", kind: "pointer", name: "Lookup", shapeName: "Index access", label: "New lookup" }),
  ],
  stack: [
    native({ id: "stack-structure", shape: "card", kind: "stack", name: "Stack", shapeName: "LIFO", label: "New stack" }),
    native({ id: "stack-push", shape: "pill", kind: "item", name: "Push", shapeName: "Stack item", label: "New pushed item" }),
    native({ id: "stack-pop", shape: "diamond", kind: "item", name: "Pop", shapeName: "Removed item", label: "New popped item" }),
    native({ id: "stack-top", shape: "circle", kind: "pointer", name: "Top", shapeName: "Top pointer", label: "New top pointer" }),
    native({ id: "stack-peek", shape: "circle", kind: "pointer", name: "Peek", shapeName: "Read access", label: "New peek" }),
    native({ id: "stack-value", shape: "pill", kind: "item", name: "Value", shapeName: "Stored item", label: "New value" }),
  ],
  queue: [
    native({ id: "queue-structure", shape: "card", kind: "queue", name: "Queue", shapeName: "FIFO", label: "New queue" }),
    native({ id: "queue-enqueue", shape: "pill", kind: "item", name: "Enqueue", shapeName: "New entry", label: "New queued item" }),
    native({ id: "queue-dequeue", shape: "diamond", kind: "item", name: "Dequeue", shapeName: "Removed entry", label: "New dequeued item" }),
    native({ id: "queue-front", shape: "circle", kind: "pointer", name: "Front", shapeName: "Front pointer", label: "New front pointer" }),
    native({ id: "queue-rear", shape: "circle", kind: "pointer", name: "Rear", shapeName: "Rear pointer", label: "New rear pointer" }),
    native({ id: "queue-value", shape: "pill", kind: "item", name: "Value", shapeName: "Queued item", label: "New value" }),
  ],
  list: [
    native({ id: "list-structure", shape: "card", kind: "list", name: "Linked list", shapeName: "Sequence", label: "New list" }),
    native({ id: "list-node", shape: "pill", kind: "item", name: "Node", shapeName: "List node", label: "New list node" }),
    native({ id: "list-payload", shape: "diamond", kind: "record", name: "Payload", shapeName: "Node data", label: "New payload" }),
    native({ id: "list-next", shape: "circle", kind: "pointer", name: "Next", shapeName: "Next pointer", label: "New link" }),
    native({ id: "list-head", shape: "circle", kind: "pointer", name: "Head", shapeName: "Head pointer", label: "New head pointer" }),
    native({ id: "list-tail", shape: "circle", kind: "pointer", name: "Tail", shapeName: "Tail pointer", label: "New tail pointer" }),
  ],
  record: [
    native({ id: "record-structure", shape: "card", kind: "record", name: "Record", shapeName: "Fields", label: "New record" }),
    native({ id: "record-field", shape: "pill", kind: "item", name: "Field", shapeName: "Record field", label: "New field" }),
    native({ id: "record-nested", shape: "diamond", kind: "record", name: "Nested record", shapeName: "Nested data", label: "New nested record" }),
    native({ id: "record-reference", shape: "circle", kind: "pointer", name: "Reference", shapeName: "Field reference", label: "New reference" }),
    native({ id: "record-key", shape: "pill", kind: "item", name: "Key", shapeName: "Field name", label: "New key" }),
    native({ id: "record-value", shape: "pill", kind: "item", name: "Value", shapeName: "Field value", label: "New value" }),
  ],
  pointer: [
    native({ id: "pointer-reference", shape: "circle", kind: "pointer", name: "Pointer", shapeName: "Reference", label: "New pointer" }),
    native({ id: "pointer-target", shape: "pill", kind: "item", name: "Target", shapeName: "Referenced value", label: "New target" }),
    native({ id: "pointer-address", shape: "diamond", kind: "record", name: "Address", shapeName: "Address record", label: "New address" }),
    native({ id: "pointer-link", shape: "circle", kind: "pointer", name: "Link", shapeName: "Reference link", label: "New link" }),
    native({ id: "pointer-null", shape: "circle", kind: "pointer", name: "Null", shapeName: "Empty reference", label: "New null pointer" }),
    native({ id: "pointer-dereference", shape: "pill", kind: "item", name: "Dereference", shapeName: "Read target", label: "New dereference" }),
  ],
  item: [
    native({ id: "item-value", shape: "pill", kind: "item", name: "Data item", shapeName: "Value", label: "New item" }),
    native({ id: "item-field", shape: "pill", kind: "item", name: "Field", shapeName: "Named value", label: "New field" }),
    native({ id: "item-record", shape: "diamond", kind: "record", name: "Record", shapeName: "Structured value", label: "New record" }),
    native({ id: "item-pointer", shape: "circle", kind: "pointer", name: "Pointer", shapeName: "Reference", label: "New pointer" }),
    native({ id: "item-array", shape: "card", kind: "array", name: "Array", shapeName: "Collection", label: "New array" }),
    native({ id: "item-list", shape: "card", kind: "list", name: "Linked list", shapeName: "Sequence", label: "New list" }),
  ],
};

const dataPaletteKinds = new Set<NodeKind>(["array", "item", "stack", "queue", "list", "record", "pointer"]);

export function shapePaletteForDocument(
  document: GraphDocument | null,
  selectedNodeId: string | null,
): readonly ShapePalettePreset[] {
  if (!document) return treePalette;
  if (document.view !== "data") return shapePalettes[document.view];

  const selected = document.nodes.find((node) => node.id === selectedNodeId);
  const contextKind = selected && dataPaletteKinds.has(selected.kind) ? selected.kind : undefined;
  return (contextKind && dataShapePalettes[contextKind]) ?? shapePalettes.data;
}
