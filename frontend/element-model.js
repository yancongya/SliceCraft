(function (root) {
    let elementSeq = 0;

    function createElementId(prefix = 'el') {
        elementSeq += 1;
        return prefix + '_' + Date.now().toString(36) + '_' + elementSeq.toString(36);
    }

    function ensureElementIdentity(element, index) {
        if (!element.id) element.id = createElementId();
        if (!element.sourceElementId) element.sourceElementId = element.id;
        if (!element.name) element.name = 'element_' + (index + 1);
        element.index = index + 1;
        return element;
    }

    function reindexElements(elements) {
        elements.forEach((element, index) => {
            ensureElementIdentity(element, index);
        });
        return elements;
    }

    function createElementFromSplit(splitElement, index, context = {}) {
        const id = splitElement.id || createElementId('element');
        const element = {
            id,
            sourceElementId: splitElement.sourceElementId || id,
            index: index + 1,
            name: splitElement.name || 'element_' + (index + 1),
            selected: Boolean(splitElement.selected),
            bbox: splitElement.bbox || null,
            sourceImageId: splitElement.sourceImageId || context.sourceImageId || null,
            sourceImageSize: splitElement.sourceImageSize || context.sourceImageSize || null,
            split: {
                preview: splitElement.preview || null,
                rawPreview: splitElement.rawPreview || null,
                type: splitElement.type || null,
            },
            remove: {
                processed: false,
                result: null,
                method: null,
            },
            upscale: {
                processed: false,
                result: null,
                resultWidth: null,
                resultHeight: null,
                inputVersion: null,
            },
            recognition: {
                label: null,
                confidence: null,
                model: null,
            },
        };
        return element;
    }

    function createSelectionState() {
        return {
            split: new Set(),
            remove: new Set(),
            upscale: new Set(),
            recognize: new Set(),
        };
    }

    function getSelectionSet(selection, tab) {
        if (!selection[tab]) selection[tab] = new Set();
        return selection[tab];
    }

    function setSelected(selection, tab, id, selected) {
        const set = getSelectionSet(selection, tab);
        if (selected) set.add(id);
        else set.delete(id);
        return set;
    }

    function setOnlySelected(selection, tab, id) {
        const set = getSelectionSet(selection, tab);
        set.clear();
        if (id) set.add(id);
        return set;
    }

    function selectAll(selection, tab, elements) {
        const set = getSelectionSet(selection, tab);
        set.clear();
        elements.forEach(element => set.add(element.id));
        return set;
    }

    function clearSelection(selection, tab) {
        getSelectionSet(selection, tab).clear();
    }

    function getSelectedElements(elements, selection, tab) {
        const set = getSelectionSet(selection, tab);
        return elements.filter(element => set.has(element.id));
    }

    function isSelected(selection, tab, id) {
        return getSelectionSet(selection, tab).has(id);
    }

    function pruneSelections(selection, elements) {
        const ids = new Set(elements.map(element => element.id));
        Object.values(selection).forEach(set => {
            Array.from(set).forEach(id => {
                if (!ids.has(id)) set.delete(id);
            });
        });
    }

    function getElementImage(element, purpose = 'latest') {
        const splitPreview = element.split?.preview || element.preview || null;
        const rawPreview = element.split?.rawPreview || element.rawPreview || splitPreview;
        const removeResult = element.remove?.processed && element.remove?.result ? element.remove.result : null;
        const upscaleResult = element.upscale?.processed && element.upscale?.result ? element.upscale.result : null;

        switch (purpose) {
            case 'split':
            case 'export-split':
                return splitPreview;
            case 'raw':
                return rawPreview || splitPreview;
            case 'remove-input':
                return upscaleResult || rawPreview || splitPreview;
            case 'remove-input-split':
                return rawPreview || splitPreview;
            case 'remove-input-upscale':
                return upscaleResult || rawPreview || splitPreview;
            case 'remove':
            case 'export-remove':
                return removeResult || rawPreview || splitPreview;
            case 'upscale-input':
                return removeResult || splitPreview;
            case 'upscale-input-split':
                return splitPreview;
            case 'upscale-input-remove':
                return removeResult || splitPreview;
            case 'upscale':
            case 'export-upscale':
                return upscaleResult || removeResult || splitPreview;
            case 'export-raw':
                return splitPreview;
            case 'recognize':
            case 'latest':
            case 'export':
            case 'export-latest':
            default:
                return upscaleResult || removeResult || splitPreview;
        }
    }

    function toLegacyElement(element, tab = 'split') {
        const image = tab === 'split' ? getElementImage(element, 'split') : getElementImage(element, tab);
        return {
            ...element,
            preview: image,
            src: image,
            rawPreview: element.split?.rawPreview || null,
            type: element.split?.type || null,
            processed: tab === 'remove' ? element.remove.processed : tab === 'upscale' ? element.upscale.processed : false,
            result: tab === 'remove' ? element.remove.result : tab === 'upscale' ? element.upscale.result : null,
            resultWidth: element.upscale.resultWidth,
            resultHeight: element.upscale.resultHeight,
            label: element.recognition.label,
            confidence: element.recognition.confidence,
        };
    }

    function makePanelElement(source, mapped, index) {
        const sourceId = source.sourceElementId || source.id || createElementId('src');
        const element = {
            ...mapped,
            id: mapped.id || createElementId(),
            sourceElementId: mapped.sourceElementId || sourceId,
            sourceImageId: mapped.sourceImageId || source.sourceImageId || source.imageId || null,
            bbox: mapped.bbox || source.bbox || null,
            sourceImageSize: mapped.sourceImageSize || source.sourceImageSize || null,
            name: mapped.name || source.name || 'element_' + (index + 1),
        };
        return ensureElementIdentity(element, index);
    }

    function syncElementsToTarget(targetItems, newElements, keyMap) {
        newElements.forEach((source) => {
            const sourceId = source.sourceElementId || source.id;
            const existingIdx = targetItems.findIndex((item) => {
                if (sourceId && item.sourceElementId === sourceId) return true;
                return item.id && source.id && item.id === source.id;
            });

            if (existingIdx < 0) {
                const mapped = keyMap(source);
                targetItems.push(makePanelElement(source, mapped, targetItems.length));
            }
        });

        return reindexElements(targetItems);
    }

    function syncNamesBySource(recognizedItems, targetGroups) {
        recognizedItems.filter((item) => item.name).forEach((recognized) => {
            const sourceId = recognized.sourceElementId || recognized.id;
            targetGroups.forEach((group) => {
                const target = group.find((item) => {
                    if (sourceId && item.sourceElementId === sourceId) return true;
                    return item.id && recognized.id && item.id === recognized.id;
                });
                if (target) target.name = recognized.name;
            });
        });
    }

    function labelForItem(item) {
        return item.recognition?.label || item.label;
    }

    function uniqueNamesFromLabels(items) {
        const labelCounts = {};
        items.filter((item) => labelForItem(item)).forEach((item) => {
            const label = labelForItem(item);
            labelCounts[label] = (labelCounts[label] || 0) + 1;
            item.name = label + '_' + String(labelCounts[label]).padStart(2, '0');
        });
    }

    function processingPreviewForElement(element) {
        const type = element.split?.type || element.type;
        const rawPreview = element.split?.rawPreview || element.rawPreview;
        if (type === 'lasso' && rawPreview) return rawPreview;
        if (!element.split && element.preview) return element.preview;
        return getElementImage(element, 'remove-input') || element.preview || element.src || element.result;
    }

    function shouldApplyLassoMask(element) {
        const type = element.split?.type || element.type;
        const preview = element.split?.preview || element.preview;
        const rawPreview = element.split?.rawPreview || element.rawPreview;
        return type === 'lasso' && Boolean(preview && rawPreview);
    }

    function shouldPreserveLassoRegion(maskCoverage, resultCoverage) {
        if (!maskCoverage || maskCoverage <= 0) return false;
        return resultCoverage / maskCoverage < 0.35;
    }

    const api = {
        createElementId,
        createElementFromSplit,
        createSelectionState,
        clearSelection,
        ensureElementIdentity,
        getElementImage,
        getSelectedElements,
        isSelected,
        pruneSelections,
        reindexElements,
        selectAll,
        setOnlySelected,
        setSelected,
        syncElementsToTarget,
        syncNamesBySource,
        toLegacyElement,
        uniqueNamesFromLabels,
        processingPreviewForElement,
        shouldApplyLassoMask,
        shouldPreserveLassoRegion,
    };

    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    root.ElementModel = api;
})(typeof window !== 'undefined' ? window : globalThis);
