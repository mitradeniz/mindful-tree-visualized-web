import type { DiagramView } from "../domain/graph-document";

export interface PlaygroundPreset {
  id: string;
  view: DiagramView;
  filename: string;
  title: string;
  shortTitle: string;
  description: string;
  source: string;
}

export const blankProjectSource = `diagram untitled "Untitled"
@view tree
`;

export const primaryPlaygroundPresets: PlaygroundPreset[] = [
  {
    id: "tree",
    view: "tree",
    filename: "thought-tree.mtree",
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
    view: "flow",
    filename: "idea-to-launch.mtree",
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
    view: "neural",
    filename: "interview-fit-network.mtree",
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
    view: "logic",
    filename: "response-selection.mtree",
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
    view: "algorithm",
    filename: "binary-search.mtree",
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
    view: "data",
    filename: "data-structures.mtree",
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

const realWorldPlaygroundPresets: PlaygroundPreset[] = [
  {
    id: "neural-image-classifier",
    view: "neural",
    filename: "cnn-image-classifier.mtree",
    title: "CNN Image Classifier",
    shortTitle: "Image classifier",
    description: "Follow pixels through convolution, pooling, and class probabilities.",
    source: `diagram cnn_classifier "CNN Image Classifier"
@view neural

input pixels "224 × 224 RGB image"
  @text "Normalized red, green, and blue pixel values enter the network."
  @feature "Signal: 150,528 input values"
  @category "Input"
layer convolution "Convolution layer"
  @text "Thirty-two 3 × 3 filters scan local regions with shared weights."
  @feature "Activation: ReLU feature maps"
  @category "Feature extraction"
neuron edges "Edge detector"
  @text "Responds strongly to horizontal and vertical intensity changes."
  @feature "Activation: local gradients"
  @category "Feature extraction"
neuron textures "Texture detector"
  @text "Combines nearby edges into repeated fur, fabric, or surface patterns."
  @feature "Activation: repeated patterns"
  @category "Feature extraction"
neuron shapes "Shape detector"
  @text "Builds larger contours from lower-level feature maps."
  @feature "Activation: object parts"
  @category "Feature extraction"
layer pooling "Max pooling"
  @text "Keeps the strongest response in each region and reduces spatial size."
  @feature "Operation: 2 × 2 downsample"
  @category "Compression"
layer classifier "Dense classifier"
  @text "Combines extracted features into evidence for each learned class."
  @feature "Activation: weighted feature sum"
  @category "Classification"
output cat "Cat probability"
  @text "Softmax confidence assigned to the cat class."
  @feature "Output example: 0.82"
  @category "Prediction"
output dog "Dog probability"
  @text "Softmax confidence assigned to the dog class."
  @feature "Output example: 0.13"
  @category "Prediction"
output other "Other probability"
  @text "Remaining probability distributed across other classes."
  @feature "Output example: 0.05"
  @category "Prediction"

connect pixels -> convolution
connect convolution -> edges
connect convolution -> textures
connect convolution -> shapes
connect edges -> pooling
connect textures -> pooling
connect shapes -> pooling
connect pooling -> classifier
connect classifier -> cat
connect classifier -> dog
connect classifier -> other
`,
  },
  {
    id: "neural-spam-filter",
    view: "neural",
    filename: "email-spam-filter.mtree",
    title: "Email Spam Filter",
    shortTitle: "Spam filter",
    description: "Combine message, sender, and link signals into a spam score.",
    source: `diagram spam_filter "Email Spam Classification Network"
@view neural

input message "Message text"
  @text "Tokenized words and phrases from the subject and body."
  @feature "Signal: token sequence"
  @category "Content"
input sender "Sender reputation"
  @text "Domain age, authentication results, and previous complaint rate."
  @feature "Signal: reputation 0.28"
  @category "Trust"
input links "Link features"
  @text "URL count, redirect depth, mismatched domains, and known blocklists."
  @feature "Signal: suspicious links 0.76"
  @category "Content"
input behavior "Delivery behavior"
  @text "Send volume, recipient similarity, and timing burst patterns."
  @feature "Signal: burst score 0.64"
  @category "Behavior"
layer embedding "Text embedding"
  @text "Maps token sequences to vectors that preserve semantic similarity."
  @feature "Activation: contextual representation"
  @category "Encoding"
neuron urgency "Urgency pattern"
  @text "Detects coercive language such as immediate payment or account closure."
  @feature "Activation example: 0.71"
  @category "Evidence"
neuron impersonation "Impersonation pattern"
  @text "Combines sender mismatch, brand language, and suspicious destination links."
  @feature "Activation example: 0.88"
  @category "Evidence"
neuron campaign "Campaign pattern"
  @text "Combines delivery bursts with repeated content across recipients."
  @feature "Activation example: 0.67"
  @category "Evidence"
layer score "Risk aggregation"
  @text "Weights independent evidence while accounting for correlated signals."
  @feature "Activation: calibrated logit"
  @category "Decision"
output spam "Spam probability"
  @text "Probability used by quarantine and warning thresholds."
  @feature "Output example: 0.93"
  @category "Prediction"
output explanation "Top contributing signals"
  @text "Returns the strongest evidence for review and model monitoring."
  @feature "Output: impersonation + links"
  @category "Prediction"

connect message -> embedding
connect embedding -> urgency
connect embedding -> impersonation
connect sender -> impersonation
connect links -> impersonation
connect behavior -> campaign
connect urgency -> score
connect impersonation -> score
connect campaign -> score
connect score -> spam
connect score -> explanation
`,
  },
  {
    id: "neural-anomaly-detection",
    view: "neural",
    filename: "service-anomaly-detector.mtree",
    title: "Service Anomaly Detector",
    shortTitle: "Anomaly detector",
    description: "Turn live operational metrics into an anomaly score and alert.",
    source: `diagram anomaly_detector "Service Anomaly Detection"
@view neural

input latency "Request latency"
  @text "Rolling p50, p95, and p99 latency measurements."
  @feature "Signal: p95 = 840 ms"
  @category "Telemetry"
input errors "Error rate"
  @text "Ratio of failed requests grouped by route and status class."
  @feature "Signal: 5xx = 4.8%"
  @category "Telemetry"
input saturation "Resource saturation"
  @text "CPU, memory pressure, connection pool use, and queue depth."
  @feature "Signal: pool use = 92%"
  @category "Telemetry"
input seasonality "Time context"
  @text "Hour, weekday, release window, and expected traffic seasonality."
  @feature "Signal: expected baseline"
  @category "Context"
layer normalize "Normalize against baseline"
  @text "Converts each metric to a comparable deviation from its normal range."
  @feature "Activation: robust z-score"
  @category "Preprocessing"
neuron deviation "Point deviation"
  @text "Detects a metric that is unusually high or low right now."
  @feature "Activation example: 0.81"
  @category "Detection"
neuron trend "Trend shift"
  @text "Detects sustained movement that may be small at each individual sample."
  @feature "Activation example: 0.73"
  @category "Detection"
neuron correlation "Cross-metric correlation"
  @text "Recognizes latency, errors, and saturation rising together."
  @feature "Activation example: 0.90"
  @category "Detection"
layer calibrate "Calibrate severity"
  @text "Combines detectors and suppresses patterns explained by seasonality."
  @feature "Activation: calibrated anomaly score"
  @category "Decision"
output score "Anomaly score"
  @text "Continuous confidence used for dashboards and thresholding."
  @feature "Output example: 0.87"
  @category "Response"
output alert "Incident alert"
  @text "Created when severity and duration exceed the operational policy."
  @feature "Output: page on-call"
  @category "Response"

connect latency -> normalize
connect errors -> normalize
connect saturation -> normalize
connect seasonality -> normalize
connect normalize -> deviation
connect normalize -> trend
connect normalize -> correlation
connect deviation -> calibrate
connect trend -> calibrate
connect correlation -> calibrate
connect seasonality -> calibrate
connect calibrate -> score
connect calibrate -> alert
`,
  },
  {
    id: "logic-scientific-calculator",
    view: "logic",
    filename: "scientific-calculator-logic.mtree",
    title: "Scientific Calculator",
    shortTitle: "Scientific calculator",
    description: "Parse an expression, select an operation, and handle domain errors.",
    source: `diagram scientific_calculator "Scientific Calculator Logic"
@view logic

input expression "Expression and angle mode"
  @text "Receive numbers, operators, parentheses, functions, and DEG or RAD mode."
  @feature "Input: sin(30) + log(100)"
  @category "Input"
process tokenize "Tokenize the expression"
  @text "Separate numbers, function names, operators, commas, and parentheses."
  @feature "Rule: reject unknown symbols"
  @category "Parsing"
decision syntax "Is the syntax valid?"
  @text "Check balanced parentheses, argument counts, and operator placement."
  @feature "Yes: build expression tree · No: syntax error"
  @category "Validation"
process precedence "Build an expression tree"
  @text "Apply function calls, powers, multiplication, division, addition, and subtraction in precedence order."
  @feature "Rule: shunting-yard precedence"
  @category "Parsing"
decision operation "Which operation is next?"
  @text "Evaluate the deepest unresolved node in the expression tree."
  @feature "Branches: arithmetic · trig · log/root"
  @category "Evaluation"
process arithmetic "Evaluate arithmetic"
  @text "Apply +, −, ×, ÷, power, factorial, and constants."
  @feature "Rule: division by zero is invalid"
  @category "Evaluation"
process trigonometry "Evaluate trigonometry"
  @text "Convert degrees to radians when needed, then evaluate sin, cos, or tan."
  @feature "Rule: respect DEG/RAD mode"
  @category "Evaluation"
process logarithm "Evaluate log or root"
  @text "Evaluate ln, log10, square root, or nth root after checking the domain."
  @feature "Rule: logarithm input > 0"
  @category "Evaluation"
decision domain "Is the operation defined?"
  @text "Reject zero division, invalid logarithms, and unsupported real roots."
  @feature "Yes: store value · No: domain error"
  @category "Validation"
decision remaining "Are unresolved nodes left?"
  @text "Continue until the root of the expression tree contains one value."
  @feature "Yes: evaluate next · No: format result"
  @category "Control"
outcome result "Display the result"
  @answer "Format with controlled precision, preserve meaningful digits, and show the active angle mode."
  @feature "Example result: 2.5"
  @category "Output"
outcome syntax_error "Show syntax error"
  @text "Highlight the token or parenthesis where parsing failed."
  @feature "Output: actionable parse message"
  @category "Error"
outcome domain_error "Show math domain error"
  @text "Explain which operation received an undefined real-number input."
  @feature "Output: operation + invalid value"
  @category "Error"

connect expression -> tokenize
connect tokenize -> syntax
connect syntax -> precedence "yes"
connect syntax -> syntax_error "no"
connect precedence -> operation
connect operation -> arithmetic "arithmetic"
connect operation -> trigonometry "trig"
connect operation -> logarithm "log/root"
connect arithmetic -> domain
connect trigonometry -> domain
connect logarithm -> domain
connect domain -> remaining "valid"
connect domain -> domain_error "invalid"
connect remaining -> operation "yes"
connect remaining -> result "no"
`,
  },
  {
    id: "logic-access-control",
    view: "logic",
    filename: "api-access-control.mtree",
    title: "API Access Control",
    shortTitle: "Access control",
    description: "Evaluate authentication, role, scope, ownership, and audit rules.",
    source: `diagram access_control "API Access Control Decision"
@view logic

input request "Incoming API request"
  @text "User token, HTTP action, resource, tenant, and request context."
  @feature "Input: principal + action + resource"
  @category "Request"
decision authenticated "Is the token valid?"
  @text "Verify signature, issuer, audience, expiry, and revocation state."
  @feature "Yes: inspect claims · No: 401"
  @category "Authentication"
decision tenant "Does the tenant match?"
  @text "Prevent a valid identity from crossing organization boundaries."
  @feature "Rule: token tenant = resource tenant"
  @category "Authorization"
decision permission "Does the role grant this action?"
  @text "Map the HTTP action to a permission and check assigned roles."
  @feature "Rule: least privilege"
  @category "Authorization"
decision ownership "Is ownership required and satisfied?"
  @text "Apply record-level policy when broad role permission is insufficient."
  @feature "Rule: owner or delegated editor"
  @category "Authorization"
process audit "Record the authorization decision"
  @text "Store principal, policy version, resource, result, and correlation ID."
  @feature "Expected result: traceable decision"
  @category "Audit"
outcome allow "Allow the request"
  @text "Continue to the protected handler with verified identity context."
  @feature "Result: 2xx path"
  @category "Response"
outcome unauthorized "Return unauthenticated"
  @text "Do not reveal whether the requested resource exists."
  @feature "Result: 401"
  @category "Response"
outcome forbidden "Return forbidden"
  @text "Reject a valid identity that lacks permission for this action."
  @feature "Result: 403"
  @category "Response"

connect request -> authenticated
connect authenticated -> tenant "valid"
connect authenticated -> unauthorized "invalid"
connect tenant -> permission "match"
connect tenant -> forbidden "mismatch"
connect permission -> ownership "granted"
connect permission -> forbidden "denied"
connect ownership -> audit "yes or not required"
connect ownership -> forbidden "no"
connect audit -> allow
`,
  },
  {
    id: "logic-checkout-risk",
    view: "logic",
    filename: "checkout-risk-routing.mtree",
    title: "Checkout Risk Routing",
    shortTitle: "Checkout risk",
    description: "Route an order through inventory, fraud, and 3-D Secure decisions.",
    source: `diagram checkout_risk "Checkout Risk Routing"
@view logic

input checkout "Checkout request"
  @text "Cart, customer, payment method, shipping address, and device signals."
  @feature "Input: order context"
  @category "Order"
decision inventory "Is inventory reserved?"
  @text "Atomically reserve available quantities before charging payment."
  @feature "Yes: price order · No: stop"
  @category "Inventory"
process price "Calculate the final amount"
  @text "Apply item prices, discounts, tax, shipping, and currency rounding."
  @feature "Expected result: immutable charge amount"
  @category "Pricing"
decision fraud "Is the risk score acceptable?"
  @text "Combine account history, device, velocity, location, and payment signals."
  @feature "Low: continue · High: reject · Medium: challenge"
  @category "Risk"
decision challenge "Is additional authentication required?"
  @text "Use policy, amount, card region, and issuer capabilities."
  @feature "Rule: request 3-D Secure when needed"
  @category "Risk"
process secure "Run 3-D Secure challenge"
  @text "Redirect or invoke the issuer challenge and verify the signed result."
  @feature "Expected result: authenticated payment intent"
  @category "Payment"
decision passed "Did authentication pass?"
  @text "Accept only a verified completion tied to the current payment intent."
  @feature "Yes: authorize · No: reject"
  @category "Payment"
process authorize "Authorize the payment"
  @text "Use an idempotency key so retries cannot create duplicate charges."
  @feature "Expected result: one authorization"
  @category "Payment"
outcome confirmed "Confirm the order"
  @text "Persist the order, consume reservation, and emit fulfillment events."
  @feature "Result: confirmed order"
  @category "Result"
outcome unavailable "Return inventory unavailable"
  @text "Release any partial reservations and suggest updated quantities."
  @feature "Result: cart update required"
  @category "Result"
outcome rejected "Reject or review the payment"
  @text "Release inventory and return a safe customer-facing response."
  @feature "Result: declined or manual review"
  @category "Result"

connect checkout -> inventory
connect inventory -> price "yes"
connect inventory -> unavailable "no"
connect price -> fraud
connect fraud -> challenge "low/medium"
connect fraud -> rejected "high"
connect challenge -> authorize "not required"
connect challenge -> secure "required"
connect secure -> passed
connect passed -> authorize "yes"
connect passed -> rejected "no"
connect authorize -> confirmed
`,
  },
  {
    id: "algorithm-dijkstra",
    view: "algorithm",
    filename: "dijkstra-shortest-path.mtree",
    title: "Dijkstra Shortest Path",
    shortTitle: "Dijkstra",
    description: "Explore a weighted graph with a priority queue and relax edges.",
    source: `diagram dijkstra "Dijkstra Shortest Path"
@view algorithm

start input "Input: graph, source, target"
  @text "Receive a graph whose edge weights are non-negative."
  @feature "Precondition: weight ≥ 0"
  @category "Input"
function shortest "shortestPath(graph, source, target)"
  @text "Find the minimum total cost from source to target."
  @feature "Complexity: O((V + E) log V)"
  @category "Function"
operation initialize "distance[*] = ∞; distance[source] = 0"
  @text "Store the best known distance and predecessor for every vertex."
  @feature "Invariant: source distance is zero"
  @category "State"
operation enqueue "push (0, source) into min-priority queue"
  @text "The queue always exposes the unsettled vertex with lowest known cost."
  @feature "Operation: priority enqueue"
  @category "Queue"
condition queued "Is the priority queue non-empty?"
  @text "Continue while a reachable unsettled vertex remains."
  @feature "Loop guard"
  @category "Loop"
operation extract "(cost, vertex) = pop minimum"
  @text "Remove the next cheapest candidate."
  @feature "Operation: O(log V) extract"
  @category "Queue"
condition stale "Is cost greater than distance[vertex]?"
  @text "Ignore queue entries superseded by a shorter path."
  @feature "Rule: skip stale entry"
  @category "Validation"
condition target "Is vertex the target?"
  @text "The first settled target has the globally shortest distance."
  @feature "Yes: reconstruct path"
  @category "Validation"
loop neighbors "For each outgoing edge"
  @text "Inspect neighbor and edge weight from the current vertex."
  @feature "Iteration: adjacency list"
  @category "Traversal"
operation candidate "candidate = cost + edge.weight"
  @text "Calculate the path cost through the current vertex."
  @feature "Operation: edge relaxation candidate"
  @category "Traversal"
condition shorter "Is candidate < distance[neighbor]?"
  @text "Only a strictly shorter route updates the best-known state."
  @feature "Invariant: distances only decrease"
  @category "Validation"
operation relax "Update distance, predecessor, and queue"
  @text "Save the better route and enqueue the neighbor with its new cost."
  @feature "Operation: relax edge"
  @category "State"
return found "Return reconstructed path and distance"
  @text "Walk predecessor links backward from target to source."
  @feature "Result: shortest path"
  @category "Output"
return missing "Return unreachable"
  @text "The queue emptied before the target could be settled."
  @feature "Result: no path"
  @category "Output"

connect input -> shortest
connect shortest -> initialize
connect initialize -> enqueue
connect enqueue -> queued
connect queued -> extract "yes"
connect queued -> missing "no"
connect extract -> stale
connect stale -> queued "yes: skip"
connect stale -> target "no"
connect target -> found "yes"
connect target -> neighbors "no"
connect neighbors -> candidate
connect candidate -> shorter
connect shorter -> relax "yes"
connect shorter -> neighbors "no: next edge"
connect relax -> neighbors "next edge"
connect neighbors -> queued "done"
`,
  },
  {
    id: "algorithm-merge-sort",
    view: "algorithm",
    filename: "merge-sort.mtree",
    title: "Merge Sort",
    shortTitle: "Merge sort",
    description: "Split recursively, then merge sorted halves in linear passes.",
    source: `diagram merge_sort "Merge Sort"
@view algorithm

start input "Input: unsorted values"
  @text "Receive an array whose elements can be compared."
  @feature "Input example: [8, 3, 5, 1]"
  @category "Input"
function sort "mergeSort(values)"
  @text "Return a new sorted array using divide and conquer."
  @feature "Complexity: O(n log n) time"
  @category "Function"
condition base "Is length ≤ 1?"
  @text "An empty or one-element array is already sorted."
  @feature "Base case"
  @category "Recursion"
return unchanged "Return values"
  @text "Stop recursion for this branch."
  @feature "Space: one leaf result"
  @category "Output"
operation split "middle = floor(length / 2)"
  @text "Split values into left and right halves."
  @feature "Operation: divide"
  @category "Divide"
operation recurse "left = mergeSort(left); right = mergeSort(right)"
  @text "Recursively sort both independent halves."
  @feature "Recurrence: 2T(n/2)"
  @category "Recursion"
operation result "merged = []"
  @text "Create output cursors for the two sorted halves."
  @feature "State: i = 0, j = 0"
  @category "Merge"
loop compare "While both halves have values"
  @text "Compare left[i] and right[j]."
  @feature "Invariant: merged remains sorted"
  @category "Merge"
condition choose "Is left[i] ≤ right[j]?"
  @text "Choose the smaller front value while preserving stability."
  @feature "Rule: left wins ties"
  @category "Merge"
operation take_left "Append left[i]; i += 1"
  @text "Move the next left value into the merged output."
  @feature "Operation: consume left"
  @category "Merge"
operation take_right "Append right[j]; j += 1"
  @text "Move the next right value into the merged output."
  @feature "Operation: consume right"
  @category "Merge"
operation remainder "Append the remaining half"
  @text "One half is empty, so the other half is already in final order."
  @feature "Operation: linear tail copy"
  @category "Merge"
return sorted "Return merged"
  @text "Return the sorted result for this recursion level."
  @feature "Space: O(n) auxiliary"
  @category "Output"

connect input -> sort
connect sort -> base
connect base -> unchanged "yes"
connect base -> split "no"
connect split -> recurse
connect recurse -> result
connect result -> compare
connect compare -> choose "both remain"
connect compare -> remainder "one empty"
connect choose -> take_left "yes"
connect choose -> take_right "no"
connect take_left -> compare "repeat"
connect take_right -> compare "repeat"
connect remainder -> sorted
`,
  },
  {
    id: "algorithm-token-bucket",
    view: "algorithm",
    filename: "token-bucket-rate-limiter.mtree",
    title: "Token Bucket Rate Limiter",
    shortTitle: "Rate limiter",
    description: "Refill tokens over time and allow bursts without exceeding policy.",
    source: `diagram token_bucket "Token Bucket Rate Limiter"
@view algorithm

start request "Input: client key and request"
  @text "Load bucket capacity, refill rate, tokens, and last refill time."
  @feature "State key: user or API credential"
  @category "Input"
function allow "allowRequest(bucket, now)"
  @text "Atomically decide whether one request may consume capacity."
  @feature "Complexity: O(1) per request"
  @category "Function"
operation elapsed "elapsed = now - lastRefill"
  @text "Measure how much refill time has accumulated."
  @feature "Use monotonic time"
  @category "Refill"
operation refill "tokens = min(capacity, tokens + elapsed × rate)"
  @text "Restore tokens continuously without exceeding burst capacity."
  @feature "Invariant: 0 ≤ tokens ≤ capacity"
  @category "Refill"
operation timestamp "lastRefill = now"
  @text "Persist the time represented by the current token count."
  @feature "State update"
  @category "Refill"
condition available "Are tokens ≥ request cost?"
  @text "A normal request costs one token; expensive operations may cost more."
  @feature "Branch: consume or reject"
  @category "Decision"
operation consume "tokens = tokens - request cost"
  @text "Consume capacity in the same atomic transaction."
  @feature "Prevent concurrent oversubscription"
  @category "Decision"
return allowed "Return allowed and remaining tokens"
  @text "Include remaining quota metadata for observability and clients."
  @feature "Result: HTTP request continues"
  @category "Output"
operation retry "retryAfter = missing tokens / refill rate"
  @text "Calculate when enough capacity should become available."
  @feature "Operation: retry estimate"
  @category "Decision"
return limited "Return rate limited and retryAfter"
  @text "Reject without consuming tokens and expose safe retry metadata."
  @feature "Result: HTTP 429"
  @category "Output"

connect request -> allow
connect allow -> elapsed
connect elapsed -> refill
connect refill -> timestamp
connect timestamp -> available
connect available -> consume "yes"
connect consume -> allowed
connect available -> retry "no"
connect retry -> limited
`,
  },
  {
    id: "data-event-loop",
    view: "data",
    filename: "javascript-event-loop.mtree",
    title: "JavaScript Event Loop",
    shortTitle: "Event loop",
    description: "Watch the call stack, microtasks, and task queue coordinate work.",
    source: `diagram event_loop "JavaScript Event Loop Structures"
@view data

stack call_stack "Call stack"
  @items "render() | handleClick() | main()"
  @text "The currently executing frame is removed first."
  @feature "LIFO · push call / pop return"
  @category "Execution"
queue microtasks "Microtask queue"
  @items "promise.then | queueMicrotask"
  @text "Drained completely after the current stack becomes empty."
  @feature "FIFO · higher priority checkpoint"
  @category "Scheduling"
queue tasks "Task queue"
  @items "timer callback | click event | network event"
  @text "The event loop takes one task when the stack is empty."
  @feature "FIFO · one task per turn"
  @category "Scheduling"
record loop_state "Event loop state"
  @fields "phase = running | stackEmpty = false | renderPending = true"
  @text "Coordinates execution checkpoints and browser rendering."
  @feature "State machine"
  @category "Runtime"
pointer current "current frame → render()"
  @text "Points to the function frame executing at the top of the stack."
  @feature "Reference: stack top"
  @category "Reference"
pointer next_microtask "next microtask → promise.then"
  @text "Selected after the call stack becomes empty."
  @feature "Reference: microtask front"
  @category "Reference"
pointer next_task "next task → timer callback"
  @text "Selected only after the microtask queue has been drained."
  @feature "Reference: task front"
  @category "Reference"

connect loop_state -> current "execute"
connect current -> call_stack "top"
connect call_stack -> next_microtask "when empty"
connect next_microtask -> microtasks "dequeue"
connect microtasks -> next_task "when drained"
connect next_task -> tasks "dequeue"
connect tasks -> call_stack "push callback"
`,
  },
  {
    id: "data-lru-cache",
    view: "data",
    filename: "lru-cache.mtree",
    title: "LRU Cache",
    shortTitle: "LRU cache",
    description: "Combine a hash map and doubly linked list for constant-time access.",
    source: `diagram lru_cache "Least Recently Used Cache"
@view data

record index "Hash map index"
  @fields "A = node_a | B = node_b | C = node_c"
  @text "Maps cache keys directly to linked-list nodes."
  @feature "Lookup: average O(1)"
  @category "Index"
list recency "Recency list"
  @items "head | B | A | C | tail"
  @text "Most recently used entries stay near head; eviction happens at tail."
  @feature "Move and eviction: O(1)"
  @category "Ordering"
record node_b "Node B"
  @fields "key = B | value = 24 | prev = head | next = A"
  @feature "Most recently used"
  @category "Entry"
record node_a "Node A"
  @fields "key = A | value = 11 | prev = B | next = C"
  @feature "Recently used"
  @category "Entry"
record node_c "Node C"
  @fields "key = C | value = 37 | prev = A | next = tail"
  @feature "Eviction candidate"
  @category "Entry"
pointer map_b "index[B] → node_b"
  @text "Hash lookup reaches the list node without traversal."
  @feature "Reference: node_b"
  @category "Reference"
pointer head_next "head.next → node_b"
  @text "The sentinel head points to the newest entry."
  @feature "Reference: node_b"
  @category "Reference"
pointer tail_prev "tail.prev → node_c"
  @text "The sentinel tail points to the least recently used entry."
  @feature "Reference: node_c"
  @category "Reference"

connect index -> map_b "lookup B"
connect map_b -> node_b "direct address"
connect recency -> head_next "front"
connect head_next -> node_b "newest"
connect node_b -> node_a "next"
connect node_a -> node_c "next"
connect node_c -> tail_prev "least recent"
`,
  },
  {
    id: "data-btree-index",
    view: "data",
    filename: "database-btree-index.mtree",
    title: "Database B-tree Index",
    shortTitle: "B-tree index",
    description: "Trace a database lookup from root keys to a sorted leaf page.",
    source: `diagram btree_index "Database B-tree Index Lookup"
@view data

record root "Root page"
  @fields "page = 1 | keys = 20, 40 | children = 2, 3, 4"
  @text "Separator keys choose the child page that can contain the search key."
  @feature "Height starts here"
  @category "Internal page"
record left "Leaf page 2"
  @fields "keys = 3, 8, 14 | rows = r3, r8, r14 | next = page 3"
  @text "Sorted keys below 20 and pointers to table rows."
  @feature "Leaf range: key < 20"
  @category "Leaf page"
record middle "Leaf page 3"
  @fields "keys = 20, 27, 35 | rows = r20, r27, r35 | next = page 4"
  @text "The target key 27 is found with a binary search inside this page."
  @feature "Leaf range: 20 ≤ key < 40"
  @category "Leaf page"
record right "Leaf page 4"
  @fields "keys = 40, 48, 61 | rows = r40, r48, r61 | next = null"
  @text "Sorted keys at or above 40."
  @feature "Leaf range: key ≥ 40"
  @category "Leaf page"
pointer child_left "child[0] → page 2"
  @feature "Reference: lower range"
  @category "Page pointer"
pointer child_middle "child[1] → page 3"
  @feature "Reference: selected for key 27"
  @category "Page pointer"
pointer child_right "child[2] → page 4"
  @feature "Reference: upper range"
  @category "Page pointer"
pointer row "key 27 → row r27"
  @text "The leaf entry stores a row identifier or the indexed row value."
  @feature "Lookup result"
  @category "Row pointer"

connect root -> child_left "key < 20"
connect child_left -> left "page 2"
connect root -> child_middle "20 ≤ key < 40"
connect child_middle -> middle "page 3"
connect root -> child_right "key ≥ 40"
connect child_right -> right "page 4"
connect middle -> row "binary search: 27"
`,
  },
];

export const playgroundPresets: PlaygroundPreset[] = [
  ...primaryPlaygroundPresets,
  ...realWorldPlaygroundPresets,
];

export function presetForView(view: DiagramView): PlaygroundPreset {
  return primaryPlaygroundPresets.find((preset) => preset.view === view) ?? primaryPlaygroundPresets[0]!;
}

export function presetById(id: string): PlaygroundPreset | undefined {
  return playgroundPresets.find((preset) => preset.id === id);
}

export function presetsForView(view: DiagramView): PlaygroundPreset[] {
  return playgroundPresets.filter((preset) => preset.view === view);
}
