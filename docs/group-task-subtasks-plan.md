# Group Task Subtasks Plan

This plan covers adding nested subtasks to group tasks so a group member can create one task and break it into smaller checklist items.

## Goal

Allow group tasks to support a parent-child structure:

- One group task can contain multiple subtasks.
- Subtasks can be checked off independently.
- The parent task shows overall progress derived from its subtasks.
- Existing flat tasks continue to work without migration breakage.

## Current Surface

The current group task flow is centered in:

- `lib/groups.ts` for the `SharedTask` model.
- `components/groups/GroupWorkspace.tsx` for Firestore reads and writes.
- `components/groups/SharedTasksPanel.tsx` for task creation, editing, filtering, and reordering.

Right now, tasks are stored as a flat list with fields like `title`, `description`, `status`, `priority`, and `position`. There is no nested subtask model yet.

## Implementation Plan

### 1) Extend the task data model

Add subtask support to the shared task type in `lib/groups.ts`.

Proposed shape:

- `subtasks: { id: string; title: string; completed: boolean; position?: number }[]`
- `subtaskCount?: number`
- `completedSubtaskCount?: number`
- `progress?: number`

Acceptance criteria:

- Older tasks without `subtasks` still render correctly.
- The model is serializable through Firestore.

### 2) Update task creation and editing flows

Update `components/groups/GroupWorkspace.tsx` and `components/groups/SharedTasksPanel.tsx` so a user can add subtasks while creating or editing a task.

Add UI support for:

- Creating a parent task with an editable subtask list.
- Adding, removing, and renaming subtasks.
- Marking subtasks complete from the task card or detail view.

Acceptance criteria:

- A task can be saved with zero or more subtasks.
- Editing a task preserves existing subtasks unless the user changes them.

### 3) Persist subtasks in Firestore

Store subtasks inside each group task document under `focusGroups/{groupId}/tasks/{taskId}`.

Keep the storage simple at first:

- Use an embedded array for subtasks.
- Recompute parent completion on write.
- Avoid a separate subcollection until nested collaboration or comments are needed.

Acceptance criteria:

- Reading a task returns the full subtask list.
- Updating a subtask does not require creating a new task document.

### 4) Derive parent task progress from subtasks

Make the parent task status or progress reflect subtask completion.

Suggested rules:

- If all subtasks are complete, parent status can move to `done`.
- If some subtasks are complete, show partial progress.
- If no subtasks exist, keep the existing flat-task behavior.

Acceptance criteria:

- The UI shows a meaningful completion state for parent tasks with subtasks.
- Progress is consistent after reload.

### 5) Improve task card presentation

Update the task list card design so subtasks are easy to scan.

Recommended UI additions:

- A compact progress bar or percentage under the title.
- A subtask count label such as `2/5 subtasks done`.
- Expand/collapse behavior for long subtask lists.

Acceptance criteria:

- Parent tasks remain readable in the main list.
- Subtasks are visible without making the layout feel crowded.

### 6) Add validation and edge-case handling

Handle the main failure modes:

- Empty subtask titles should be blocked.
- Duplicate blank subtasks should not be saved.
- Deleting a parent task should delete its subtasks with it.
- Reordering should preserve subtask order.

Acceptance criteria:

- Invalid subtask input is rejected before save.
- No orphaned subtask state remains in the UI.

### 7) Update rules and tests

Review any Firestore rules, indexes, or tests that assume a flat task shape.

Targets to check:

- `firestore.rules`
- `firestore.indexes.json`
- `tests/` for task flow coverage

Acceptance criteria:

- Group members can still read/write their tasks safely.
- A task with subtasks saves and loads in tests.

## Suggested Order

1. Extend the task type.
2. Add UI for subtask editing.
3. Persist the embedded subtask array.
4. Derive progress and status.
5. Polish the card presentation.
6. Add validation and tests.

## Definition of Done

- Users can create a group task with subtasks.
- Users can mark subtasks complete independently.
- Parent task progress updates correctly.
- Existing flat tasks still work.
- The feature is covered by at least one test or manual verification note.