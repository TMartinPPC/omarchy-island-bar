const assert = require("assert")
const BarModel = require("../BarModel.js")

let passed = 0
function test(name, fn) {
  fn()
  passed++
  console.log("ok - " + name)
}

test("normalizePosition accepts the four edges", () => {
  for (const edge of ["top", "bottom", "left", "right"]) {
    assert.strictEqual(BarModel.normalizePosition(edge), edge)
  }
})

test("normalizePosition falls back to top", () => {
  assert.strictEqual(BarModel.normalizePosition(""), "top")
  assert.strictEqual(BarModel.normalizePosition("sideways"), "top")
  assert.strictEqual(BarModel.normalizePosition(null), "top")
  assert.strictEqual(BarModel.normalizePosition(" TOP "), "top")
})

test("entryId reads string and object entries", () => {
  assert.strictEqual(BarModel.entryId("omarchy.clock"), "omarchy.clock")
  assert.strictEqual(BarModel.entryId({ id: "omarchy.clock" }), "omarchy.clock")
  assert.strictEqual(BarModel.entryId({}), "")
  assert.strictEqual(BarModel.entryId(null), "")
})

test("entrySettings copies everything but id", () => {
  const settings = BarModel.entrySettings({ id: "omarchy.clock", format: "HH:mm", pill: false })
  assert.deepStrictEqual(settings, { format: "HH:mm", pill: false })
  assert.deepStrictEqual(BarModel.entrySettings("omarchy.clock"), {})
})

test("pinTrayToInner puts tray last on left/center", () => {
  const entries = ["omarchy.tray", "a", "b"]
  assert.deepStrictEqual(BarModel.pinTrayToInner(entries, "left"), ["a", "b", "omarchy.tray"])
  assert.deepStrictEqual(BarModel.pinTrayToInner(entries, "center"), ["a", "b", "omarchy.tray"])
})

test("pinTrayToInner puts tray first on right", () => {
  const entries = ["a", "omarchy.tray", "b"]
  assert.deepStrictEqual(BarModel.pinTrayToInner(entries, "right"), ["omarchy.tray", "a", "b"])
})

test("entryIndex / entriesBefore / entriesAfter", () => {
  const entries = ["a", "b", "c"]
  assert.strictEqual(BarModel.entryIndex(entries, "b"), 1)
  assert.strictEqual(BarModel.entryIndex(entries, "z"), -1)
  assert.deepStrictEqual(BarModel.entriesBefore(entries, "c"), ["a", "b"])
  assert.deepStrictEqual(BarModel.entriesAfter(entries, "a"), ["b", "c"])
  assert.deepStrictEqual(BarModel.entriesBefore(entries, "a"), [])
  assert.deepStrictEqual(BarModel.entriesAfter(entries, "z"), [])
})

test("inlineSettingsDelta detects settings-only change", () => {
  const current = { left: [{ id: "w", show: true }], center: [], right: [] }
  const next = { left: [{ id: "w", show: false }], center: [], right: [] }
  const delta = BarModel.inlineSettingsDelta(current, next)
  assert.ok(Array.isArray(delta))
  assert.strictEqual(delta.length, 1)
  assert.strictEqual(delta[0].region, "left")
  assert.strictEqual(delta[0].index, 0)
  assert.strictEqual(delta[0].entry.show, false)
})

test("inlineSettingsDelta rejects structural changes", () => {
  const a = { left: ["x"], center: [], right: [] }
  const b = { left: ["x", "y"], center: [], right: [] }
  assert.strictEqual(BarModel.inlineSettingsDelta(a, b), null)

  const c = { left: ["x"], center: [], right: [] }
  const d = { left: ["y"], center: [], right: [] }
  assert.strictEqual(BarModel.inlineSettingsDelta(c, d), null)
})

test("inlineSettingsDelta rejects custom modules and duplicate ids", () => {
  const current = { left: [{ id: "w", exec: "ls" }], center: [], right: [] }
  const next = { left: [{ id: "w", exec: "ls -l" }], center: [], right: [] }
  assert.strictEqual(BarModel.inlineSettingsDelta(current, next), null)

  const curDup = { left: ["w", "w"], center: [], right: [] }
  const nextDup = { left: ["w", { id: "w" }], center: [], right: [] }
  assert.strictEqual(BarModel.inlineSettingsDelta(curDup, nextDup), null)
})

test("inlineSettingsDelta covers centerBegin, centerEnd and tray", () => {
  const current = {
    left: [], centerBegin: [{ id: "omarchy.indicators" }], center: [],
    centerEnd: [{ id: "omarchy.weather", unit: "C" }], right: [],
    tray: [{ id: "superwhisper.panel", visible: true }]
  }
  const next = {
    left: [], centerBegin: [{ id: "omarchy.indicators", hidden: ["dropbox"] }], center: [],
    centerEnd: [{ id: "omarchy.weather", unit: "F" }], right: [],
    tray: [{ id: "superwhisper.panel", visible: false }]
  }
  const delta = BarModel.inlineSettingsDelta(current, next)
  assert.ok(Array.isArray(delta))
  assert.strictEqual(delta.length, 3)
  assert.deepStrictEqual(delta.map((c) => c.region), ["centerBegin", "centerEnd", "tray"])
  assert.strictEqual(delta.find((c) => c.region === "tray").entry.visible, false)
})

test("inlineSettingsDelta rejects structural tray changes", () => {
  const a = { left: [], center: [], right: [], tray: ["superwhisper.panel"] }
  const b = { left: [], center: [], right: [], tray: ["io.github.twiking.omacontrol"] }
  assert.strictEqual(BarModel.inlineSettingsDelta(a, b), null)
})

test("pickPanelSlot prefers an opened copy, then the focused screen", () => {
  const candidates = [
    { slot: { visible: true, width: 10, height: 10 }, screenName: "DP-1", opened: false },
    { slot: { visible: true, width: 10, height: 10 }, screenName: "HDMI-1", opened: true },
    { slot: { visible: true, width: 10, height: 10 }, screenName: "DP-1", opened: true }
  ]
  assert.strictEqual(BarModel.pickPanelSlot(candidates, "DP-1"), candidates[2].slot)
  assert.strictEqual(BarModel.pickPanelSlot(candidates, ""), candidates[1].slot)
})

test("pickPanelSlot skips zero-size placeholders when a drawn slot exists", () => {
  const placeholder = { slot: { visible: true, width: 0, height: 0 }, screenName: "DP-1", opened: false }
  const drawn = { slot: { visible: true, width: 10, height: 10 }, screenName: "DP-1", opened: false }
  assert.strictEqual(BarModel.pickPanelSlot([placeholder, drawn], "DP-1"), drawn.slot)
})

test("nearestDropTarget picks closest edge and side", () => {
  const rows = [
    { slot: "a", x: 0, y: 0, width: 100, height: 10 },
    { slot: "b", x: 110, y: 0, width: 100, height: 10 }
  ]
  assert.deepStrictEqual(BarModel.nearestDropTarget(rows, { x: 5, y: 5 }, false), { slot: "a", after: false })
  assert.deepStrictEqual(BarModel.nearestDropTarget(rows, { x: 95, y: 5 }, false), { slot: "a", after: true })
  assert.deepStrictEqual(BarModel.nearestDropTarget(rows, { x: 115, y: 5 }, false), { slot: "b", after: false })
  assert.strictEqual(BarModel.nearestDropTarget([], { x: 0, y: 0 }, false), null)
})

test("expandPath expands ~ and $HOME", () => {
  assert.strictEqual(BarModel.expandPath("~/foo", "/home/fab"), "/home/fab/foo")
  assert.strictEqual(BarModel.expandPath("$HOME/foo", "/home/fab"), "/home/fab/foo")
  assert.strictEqual(BarModel.expandPath("/abs/foo", "/home/fab"), "/abs/foo")
  assert.strictEqual(BarModel.expandPath("", "/home/fab"), "")
})

test("customModuleType infers from entry shape", () => {
  assert.strictEqual(BarModel.customModuleType({ id: "w", source: "~/w.qml" }), "qml")
  assert.strictEqual(BarModel.customModuleType({ id: "w", exec: "date" }), "command")
  assert.strictEqual(BarModel.customModuleType({ id: "w", type: "qml" }), "qml")
  assert.strictEqual(BarModel.customModuleType({ id: "w" }), "")
})

test("customModuleSafeName blocks traversal and absolute paths", () => {
  assert.ok(BarModel.customModuleSafeName("my-widget"))
  assert.ok(!BarModel.customModuleSafeName("../etc/passwd"))
  assert.ok(!BarModel.customModuleSafeName("/etc/passwd"))
  assert.ok(!BarModel.customModuleSafeName(""))
})

test("sectionDropZone grows the section by half the bar thickness", () => {
  const section = { x: 100, y: 0, width: 50, height: 30 }
  const zone = BarModel.sectionDropZone(section, 40, false, null)
  assert.deepStrictEqual(zone, { x: 80, y: 0, width: 90, height: 30 })

  const verticalZone = BarModel.sectionDropZone({ x: 0, y: 100, width: 30, height: 50 }, 40, true, null)
  assert.deepStrictEqual(verticalZone, { x: 0, y: 80, width: 30, height: 90 })
})

test("sectionDropZone stops short of the tray's own ends", () => {
  const section = { x: 100, y: 0, width: 50, height: 30 }
  const tray = { x: 100, y: 0, width: 50, height: 30 }
  const zone = BarModel.sectionDropZone(section, 40, false, tray)
  // Half a reach (20) in from the tray's start and end: a drop beside the
  // tray's pinned icons lands on the bar, not in the drawer.
  assert.deepStrictEqual(zone, { x: 120, y: 0, width: 10, height: 30 })
})

test("traySectionDrop lands among the section's rows or at its end", () => {
  const zone = { x: 120, y: 0, width: 50, height: 30 }
  const rows = [
    { slot: "a", x: 120, y: 0, width: 20, height: 30 },
    { slot: "b", x: 150, y: 0, width: 20, height: 30 }
  ]
  assert.deepStrictEqual(BarModel.traySectionDrop(rows, zone, { x: 138, y: 5 }, false), { slot: "a", after: true })
  assert.deepStrictEqual(BarModel.traySectionDrop(rows, zone, { x: 162, y: 5 }, false), { slot: "b", after: true })
  // Off the zone, the drawer widgets are out of reach.
  assert.strictEqual(BarModel.traySectionDrop(rows, zone, { x: 40, y: 5 }, false), null)
  // An empty section takes the widget whole.
  assert.deepStrictEqual(BarModel.traySectionDrop([], zone, { x: 140, y: 5 }, false), { region: "tray", after: true })
  // No tray hosting the section, no drop.
  assert.strictEqual(BarModel.traySectionDrop(rows, null, { x: 140, y: 5 }, false), null)
})

console.log("\n" + passed + " tests passed")
