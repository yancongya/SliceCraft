const test = require('node:test');
const assert = require('node:assert/strict');

const {
    createElementFromSplit,
    createSelectionState,
    getElementImage,
    getSelectedElements,
    reindexElements,
    processingPreviewForElement,
    setSelected,
    syncElementsToTarget,
    syncNamesBySource,
    uniqueNamesFromLabels,
    shouldApplyLassoMask,
    shouldPreserveLassoRegion,
} = require('../frontend/element-model.js');

test('createElementFromSplit creates a unified element from split output', () => {
    const element = createElementFromSplit({
        index: 2,
        bbox: [10, 20, 30, 40],
        preview: 'split.png',
        rawPreview: 'raw.png',
        type: 'lasso',
    }, 1, { sourceImageId: 'img-1', sourceImageSize: { w: 100, h: 200 } });

    assert.equal(element.index, 2);
    assert.equal(element.name, 'element_2');
    assert.deepEqual(element.bbox, [10, 20, 30, 40]);
    assert.equal(element.split.preview, 'split.png');
    assert.equal(element.split.rawPreview, 'raw.png');
    assert.equal(element.split.type, 'lasso');
    assert.equal(element.remove.processed, false);
    assert.equal(element.upscale.processed, false);
    assert.equal(element.recognition.label, null);
});

test('getElementImage chooses the expected version for each purpose', () => {
    const element = createElementFromSplit({ preview: 'split.png', rawPreview: 'raw.png' }, 0);
    element.remove.result = 'removed.png';
    element.remove.processed = true;
    element.upscale.result = 'upscaled.png';
    element.upscale.processed = true;

    assert.equal(getElementImage(element, 'split'), 'split.png');
    assert.equal(getElementImage(element, 'remove-input'), 'upscaled.png');
    assert.equal(getElementImage(element, 'upscale-input'), 'removed.png');
    assert.equal(getElementImage(element, 'recognize'), 'upscaled.png');
    assert.equal(getElementImage(element, 'export'), 'upscaled.png');
    assert.equal(getElementImage(element, 'export-remove'), 'removed.png');
});

test('selection is independent per tab while sharing element data', () => {
    const elements = [
        createElementFromSplit({ preview: 'a.png' }, 0),
        createElementFromSplit({ preview: 'b.png' }, 1),
    ];
    const selection = createSelectionState();

    setSelected(selection, 'split', elements[0].id, true);
    setSelected(selection, 'remove', elements[1].id, true);

    assert.deepEqual(getSelectedElements(elements, selection, 'split').map(el => el.id), [elements[0].id]);
    assert.deepEqual(getSelectedElements(elements, selection, 'remove').map(el => el.id), [elements[1].id]);
});

test('syncElementsToTarget deduplicates by stable source id instead of editable name', () => {
    const split = reindexElements([
        { id: 'split-a', sourceElementId: 'split-a', name: 'button', preview: 'a.png', bbox: [10, 20, 30, 40] },
    ]);
    const remove = [];

    syncElementsToTarget(remove, split, (element) => ({
        preview: element.preview,
        selected: true,
        processed: false,
        result: null,
        name: element.name,
    }));

    split[0].name = 'renamed-button';
    syncElementsToTarget(remove, split, (element) => ({
        preview: element.preview,
        selected: true,
        processed: false,
        result: null,
        name: element.name,
    }));

    assert.equal(remove.length, 1);
    assert.equal(remove[0].sourceElementId, 'split-a');
    assert.deepEqual(remove[0].bbox, [10, 20, 30, 40]);
});

test('reindexElements preserves user names while compacting display indexes', () => {
    const elements = reindexElements([
        { id: 'a', sourceElementId: 'a', name: 'primary_button' },
        { id: 'b', sourceElementId: 'b', name: 'close_icon' },
        { id: 'c', sourceElementId: 'c', name: 'logo' },
    ]);

    elements.splice(1, 1);
    reindexElements(elements);

    assert.deepEqual(elements.map((element) => element.index), [1, 2]);
    assert.deepEqual(elements.map((element) => element.name), ['primary_button', 'logo']);
});

test('syncNamesBySource updates the matching source element, not the same display index', () => {
    const split = reindexElements([
        { id: 'a', sourceElementId: 'a', name: 'first' },
        { id: 'b', sourceElementId: 'b', name: 'second' },
    ]);
    const recognize = reindexElements([
        { id: 'r1', sourceElementId: 'b', name: 'confirm_button' },
    ]);

    syncNamesBySource(recognize, [split]);

    assert.equal(split[0].name, 'first');
    assert.equal(split[1].name, 'confirm_button');
});

test('uniqueNamesFromLabels gives repeated labels stable numbered names', () => {
    const items = [
        { label: 'icon' },
        { label: 'button' },
        { label: 'icon' },
    ];

    uniqueNamesFromLabels(items);

    assert.deepEqual(items.map((item) => item.name), ['icon_01', 'button_01', 'icon_02']);
});

test('uniqueNamesFromLabels only renames items that have labels', () => {
    const items = [
        { name: 'element_1', label: 'person' },
        { name: 'element_2' },
    ];

    uniqueNamesFromLabels(items);

    assert.deepEqual(items.map((item) => item.name), ['person_01', 'element_2']);
});

test('processingPreviewForElement uses raw preview for lasso elements', () => {
    assert.equal(
        processingPreviewForElement({
            type: 'lasso',
            preview: 'masked-lasso.png',
            rawPreview: 'raw-bbox.png',
        }),
        'raw-bbox.png',
    );
    assert.equal(
        processingPreviewForElement({
            type: 'auto',
            preview: 'auto-crop.png',
            rawPreview: 'unused.png',
        }),
        'auto-crop.png',
    );
});

test('shouldApplyLassoMask only applies when lasso has separate raw input', () => {
    assert.equal(shouldApplyLassoMask({
        type: 'lasso',
        preview: 'masked-lasso.png',
        rawPreview: 'raw-bbox.png',
    }), true);
    assert.equal(shouldApplyLassoMask({
        type: 'lasso',
        preview: 'masked-lasso.png',
    }), false);
    assert.equal(shouldApplyLassoMask({
        type: 'auto',
        preview: 'auto-crop.png',
        rawPreview: 'raw-bbox.png',
    }), false);
});

test('shouldPreserveLassoRegion detects over-aggressive AI results', () => {
    assert.equal(shouldPreserveLassoRegion(0.45, 0.08), true);
    assert.equal(shouldPreserveLassoRegion(0.45, 0.30), false);
    assert.equal(shouldPreserveLassoRegion(0, 0.08), false);
});
