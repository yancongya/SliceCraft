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

    function uniqueNamesFromLabels(items) {
        const labelCounts = {};
        items.filter((item) => item.label).forEach((item) => {
            labelCounts[item.label] = (labelCounts[item.label] || 0) + 1;
            item.name = item.label + '_' + String(labelCounts[item.label]).padStart(2, '0');
        });
    }

    function processingPreviewForElement(element) {
        if (element.type === 'lasso' && element.rawPreview) return element.rawPreview;
        return element.preview || element.src || element.result;
    }

    function shouldApplyLassoMask(element) {
        return element.type === 'lasso' && Boolean(element.preview && element.rawPreview);
    }

    function shouldPreserveLassoRegion(maskCoverage, resultCoverage) {
        if (!maskCoverage || maskCoverage <= 0) return false;
        return resultCoverage / maskCoverage < 0.35;
    }

    const api = {
        createElementId,
        ensureElementIdentity,
        reindexElements,
        syncElementsToTarget,
        syncNamesBySource,
        uniqueNamesFromLabels,
        processingPreviewForElement,
        shouldApplyLassoMask,
        shouldPreserveLassoRegion,
    };

    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    root.ElementModel = api;
})(typeof window !== 'undefined' ? window : globalThis);
