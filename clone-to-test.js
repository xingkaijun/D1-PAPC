import crypto from 'crypto';

async function cloneProject() {
    const oldId = 'bo54xud6z'; // Shell LNG project ID
    const newId = 'test_project_id';
    const newName = 'test';

    console.log(`Fetching original project: ${oldId}`);
    const res = await fetch(`http://127.0.0.1:8787/projects/${oldId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
    });
    if (!res.ok) throw new Error(`Failed to fetch project: ${res.status}`);
    const project = await res.json();

    console.log(`Fetching review tracker for: ${oldId}`);
    const rtRes = await fetch(`http://127.0.0.1:8787/projects/${oldId}/review-tracker`);
    if (!rtRes.ok) throw new Error(`Failed to fetch tracker: ${rtRes.status}`);
    const oldTracker = await rtRes.json();

    project.id = newId;
    project.name = newName;

    const newTracker = {};
    let drawingCount = 0;

    console.log('Generating new IDs to prevent overwriting original data...');
    project.drawings.forEach(d => {
        const oldDrawingId = d.id;
        const newDrawingId = crypto.randomUUID();
        d.id = newDrawingId;

        if (Array.isArray(d.statusHistory)) {
            d.statusHistory.forEach(h => {
                h.id = crypto.randomUUID();
            });
        }

        if (oldTracker[oldDrawingId]) {
            newTracker[newDrawingId] = oldTracker[oldDrawingId];
        }
        drawingCount++;
    });

    console.log(`Cloning project into D1 with ${drawingCount} drawings...`);
    const saveRes = await fetch(`http://127.0.0.1:8787/projects/${newId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project, reviewTracker: newTracker })
    });

    if (!saveRes.ok) {
        const text = await saveRes.text();
        throw new Error(`Failed to save cloned project: ${saveRes.status} - ${text}`);
    }

    console.log('Successfully cloned "Shell LNG" to "test" project!');
}

cloneProject().catch(console.error);
