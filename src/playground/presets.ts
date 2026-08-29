import type { DiagramView } from "../domain/graph-document";

export interface PlaygroundPreset {
  id: DiagramView;
  title: string;
  shortTitle: string;
  description: string;
  source: string;
}

export const playgroundPresets: PlaygroundPreset[] = [
  {
    id: "tree",
    title: "Thought Tree",
    shortTitle: "Tree",
    description: "Questions branch into possible responses and follow-ups.",
    source: `diagram interview_tree "Interview Thought Tree"
@view tree

topic introduction "Introduction"
  @text "Prepare a short opening and the follow-ups it is likely to trigger."
  @feature "Interview section"
  question about_you "Tell me about yourself."
    @text "Connect your present role, strongest evidence, and motivation."
    @feature "Follow-up: What did you own?"
    response concise "Concise backend introduction"
      @answer "I build reliable backend services and recently owned an API from design through production observability. I want to bring that experience to a product where performance and clear engineering decisions matter."
      @feature "Present → evidence → role fit"
      @tag preferred
      @color green
      @status active
      followup ownership "What did you own in that project?"
        @text "Separate your responsibility from the team's shared work."
        @feature "Probe: trade-offs"
        response architecture "Architecture ownership"
          @answer "I defined the service boundaries, API contract, rollout plan, and production dashboards, then documented why we delayed asynchronous processing until the load justified it."
          @feature "Evidence: decision and trade-off"
        response collaboration "Team decision-making"
          @answer "I used a short RFC, review sessions, and staged rollout checkpoints so dependent teams could challenge and safely adopt the change."
          @feature "Evidence: RFC and rollout"
    response technical "Systems-first introduction"
      @answer "I enjoy turning ambiguous needs into observable services with clear contracts, especially using TypeScript, PostgreSQL, and performance analysis."
      @feature "Use for a technical interviewer"
      followup stack "Which technologies did you use?"
        @text "Explain why each tool mattered instead of listing names only."
        @feature "Probe: why this stack?"
        response stack_answer "Technology choices"
          @answer "TypeScript and Node.js kept delivery fast, PostgreSQL provided transactional guarantees, and tracing made optimization decisions measurable."
          @feature "Tool → reason → outcome"
`,
  },
  {
    id: "flow",
    title: "Left-to-right Flow",
    shortTitle: "Flow",
    description: "A clear sequence with decisions and named transitions.",
    source: `diagram launch_flow "Idea to Launch"
@view flow

input idea "Idea"
  @text "State the problem and the person experiencing it."
  @feature "Input: problem hypothesis"
process research "Research the problem"
  @text "Collect interviews, alternatives, and observable pain points."
  @feature "Expected result: evidence"
process prototype "Build a focused prototype"
  @text "Test one risky assumption with the smallest useful artifact."
  @feature "Output: testable prototype"
  @status active
decision validate "Does the prototype solve the problem?"
  @text "Compare observed behavior with the success criterion."
  @feature "Rule: evidence meets threshold"
  @color amber
process refine "Refine the weak assumptions"
  @text "Change the unsupported assumption, not every part of the solution."
  @feature "Output: revised hypothesis"
outcome launch "Launch the first version"
  @text "Release with a measurement plan and a reversible rollout."
  @feature "Result: learning in production"
  @color green
  @status done

connect idea -> research
connect research -> prototype
connect prototype -> validate
connect validate -> launch "yes"
connect validate -> refine "not yet"
connect refine -> prototype "try again"
`,
  },
  {
    id: "neural",
    title: "Neural Flow",
    shortTitle: "Neural",
    description: "Inputs activate layered neurons before producing outputs.",
    source: `diagram neural_flow "Interview Fit Network"
@view neural

input experience "Experience"
  @text "Relevant systems, scope, and years of hands-on ownership."
  @feature "Signal strength: 0.82"
input communication "Communication"
  @text "Clarity, structure, and adaptation to the interviewer."
  @feature "Signal strength: 0.74"
input impact "Measured impact"
  @text "Latency, reliability, cost, adoption, or delivery evidence."
  @feature "Signal strength: 0.91"

neuron technical "Technical depth"
  @text "Architecture decisions and understanding of trade-offs."
  @feature "Activation: experience × depth"
neuron ownership "Ownership signal"
  @text "Personal decisions, follow-through, and production responsibility."
  @feature "Activation: impact + experience"
neuron clarity "Answer clarity"
  @text "Concise structure with enough context to remain credible."
  @feature "Activation: communication"
neuron relevance "Role relevance"
  @text "Direct connection between evidence and the target role."
  @feature "Activation: impact × role"

output fit "Fit score"
  @text "Combined confidence that the answer demonstrates role fit."
  @feature "Output: weighted confidence"
output followup "Suggested follow-up"
  @text "The next probe most likely to test a weak or interesting signal."
  @feature "Output: highest uncertainty"

connect experience -> technical
connect experience -> ownership
connect communication -> clarity
connect impact -> ownership
connect impact -> relevance
connect technical -> fit
connect ownership -> fit
connect clarity -> followup
connect relevance -> fit
connect relevance -> followup
`,
  },
  {
    id: "logic",
    title: "Logic Flow",
    shortTitle: "Logic",
    description: "Run conditions live and choose the next branch.",
    source: `diagram logic_flow "Response Selection Logic"
@view logic

input prompt "Incoming question"
  @text "Identify whether the question asks for behavior, knowledge, or judgment."
  @feature "Rule: classify intent"
decision has_example "Do I have a strong real example?"
  @text "Prefer a specific story where your own decision is visible."
  @feature "Yes: STAR · No: concise fallback"
process use_star "Answer with the STAR structure"
  @text "Give brief context, your action, and the measurable result."
  @feature "Expected result: credible story"
decision has_metrics "Do I have measurable results?"
  @text "Use verified numbers or a clearly observable outcome."
  @feature "Yes: quantify · No: explain evidence"
process add_context "Give concise context and responsibility"
  @text "Clarify scope and ownership without inventing a number."
  @feature "Expected result: honest evidence"
outcome complete "Deliver the complete answer"
  @answer "State the answer, support it with one decision, then close with the result and what you learned."
  @feature "Target: 60–90 seconds"
outcome concise "Give the concise fallback answer"
  @answer "Explain the principle you would use, name the first concrete action, and state what evidence would change your decision."
  @feature "Target: 30–45 seconds"

connect prompt -> has_example
connect has_example -> use_star "yes"
connect has_example -> concise "no"
connect use_star -> has_metrics
connect has_metrics -> complete "yes"
connect has_metrics -> add_context "no"
connect add_context -> complete
`,
  },
  {
    id: "algorithm",
    title: "Pseudocode Algorithm",
    shortTitle: "Algorithm",
    description: "Turn functions, loops, conditions, and returns into a runnable path.",
    source: `diagram binary_search "Binary Search"
@view algorithm

start begin "Input: sorted array and target"
  @text "Receive an ordered collection and the value to locate."
  @feature "Contract: sorted input"
function search "binarySearch(values, target)"
  @text "Search by repeatedly eliminating half of the remaining range."
  @feature "Complexity: O(log n) time"
operation bounds "low = 0; high = length - 1"
  @text "Initialize an inclusive search interval."
  @feature "State: [low, high]"
condition remaining "low <= high?"
  @text "Continue while the interval still contains a candidate."
  @feature "Invariant: target can only be inside range"
operation midpoint "mid = floor((low + high) / 2)"
  @text "Choose the center index without scanning the interval."
  @feature "Operation: halve search space"
condition found "values[mid] == target?"
  @text "Compare the middle value with the target."
  @feature "Yes: return index"
return success "return mid"
  @text "Return the matching index immediately."
  @feature "Complexity: O(1) space"
condition lower "values[mid] < target?"
  @text "Decide which half can still contain the target."
  @feature "Branch: discard lower or upper half"
operation move_low "low = mid + 1"
  @text "Discard the middle and lower half."
  @feature "State update: lower bound"
operation move_high "high = mid - 1"
  @text "Discard the middle and upper half."
  @feature "State update: upper bound"
return missing "return -1"
  @text "Signal that the target does not exist in the collection."
  @feature "Exit: interval exhausted"

connect begin -> search
connect search -> bounds
connect bounds -> remaining
connect remaining -> midpoint "yes"
connect remaining -> missing "no"
connect midpoint -> found
connect found -> success "yes"
connect found -> lower "no"
connect lower -> move_low "yes"
connect lower -> move_high "no"
connect move_low -> remaining "repeat"
connect move_high -> remaining "repeat"
`,
  },
  {
    id: "data",
    title: "Data Structure",
    shortTitle: "Data",
    description: "Compare arrays, stacks, queues, records, and linked references.",
    source: `diagram data_structures "Data Structure Playground"
@view data

array scores "Scores"
  @items "8 | 3 | 5 | 1"
  @text "An indexed collection. Read a value by its position."
  @feature "Access: O(1) by index"
item score_index "index = 2 → 5"
  @text "The third cell is selected without scanning the earlier cells."
  @feature "Index lookup"
stack undo_stack "Undo stack"
  @items "edit-3 | edit-2 | edit-1"
  @text "The newest edit is removed first."
  @feature "LIFO · push / pop"
queue render_queue "Render queue"
  @items "parse | layout | render"
  @text "The first queued job is processed first."
  @feature "FIFO · enqueue / dequeue"
list chain "Linked list"
  @items "head | node_a | node_b | null"
  @text "Each link points to the next record in sequence."
  @feature "Traversal: O(n)"
record user_record "User record"
  @fields "id = 42 | name = Ada | role = engineer"
  @text "A record groups named fields under one value."
  @feature "Key-value fields"
record node_a "Node A"
  @fields "value = 8 | next = node_b"
  @feature "Address: node_a"
record node_b "Node B"
  @fields "value = 3 | next = null"
  @feature "Address: node_b"
pointer next_a "next → node_b"
  @text "A pointer stores the address of another record."
  @feature "Reference: node_b"
pointer next_b "next → null"
  @text "A null pointer marks the end of the list."
  @feature "Reference: null"

connect scores -> score_index "index 2"
connect chain -> node_a "head"
connect node_a -> next_a "next"
connect next_a -> node_b "points to"
connect node_b -> next_b "next"
connect user_record -> node_a "related value"
`,
  },
];

export function presetForView(view: DiagramView): PlaygroundPreset {
  return playgroundPresets.find((preset) => preset.id === view) ?? playgroundPresets[0]!;
}
