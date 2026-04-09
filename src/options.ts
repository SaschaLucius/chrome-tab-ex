import {
  GroupingRule,
  getGroupingRules,
  saveGroupingRules,
} from "./customRules";

const rulesBody = document.getElementById(
  "rulesBody"
) as HTMLTableSectionElement;
const addRuleBtn = document.getElementById("addRule") as HTMLButtonElement;
const saveRulesBtn = document.getElementById("saveRules") as HTMLButtonElement;
const statusEl = document.getElementById("status") as HTMLElement;

function addRuleRow(rule?: GroupingRule) {
  const tr = document.createElement("tr");

  const tdHost = document.createElement("td");
  const hostInput = document.createElement("input");
  hostInput.type = "text";
  hostInput.placeholder = "e.g. docs.google.com";
  hostInput.value = rule?.host ?? "";
  tdHost.appendChild(hostInput);

  const tdDepth = document.createElement("td");
  const depthInput = document.createElement("input");
  depthInput.type = "number";
  depthInput.min = "1";
  depthInput.max = "10";
  depthInput.value = String(rule?.pathDepth ?? 1);
  tdDepth.appendChild(depthInput);

  const tdAction = document.createElement("td");
  const removeBtn = document.createElement("button");
  removeBtn.textContent = "Remove";
  removeBtn.className = "danger";
  removeBtn.addEventListener("click", () => tr.remove());
  tdAction.appendChild(removeBtn);

  tr.appendChild(tdHost);
  tr.appendChild(tdDepth);
  tr.appendChild(tdAction);
  rulesBody.appendChild(tr);
}

function collectRules(): GroupingRule[] {
  const rules: GroupingRule[] = [];
  const rows = rulesBody.querySelectorAll("tr");
  rows.forEach((row) => {
    const inputs = row.querySelectorAll("input");
    const host = inputs[0]?.value.trim();
    const depth = parseInt(inputs[1]?.value, 10);
    if (host && depth > 0) {
      rules.push({ host, pathDepth: depth });
    }
  });
  return rules;
}

async function loadRules() {
  const rules = await getGroupingRules();
  rules.forEach((r) => addRuleRow(r));
}

addRuleBtn.addEventListener("click", () => addRuleRow());

saveRulesBtn.addEventListener("click", async () => {
  const rules = collectRules();
  await saveGroupingRules(rules);
  statusEl.style.display = "block";
  setTimeout(() => {
    statusEl.style.display = "none";
  }, 2000);
});

loadRules();
