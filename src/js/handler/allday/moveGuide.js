/**
 * @fileoverview Effect module for Allday.Move
 * @author NHN Ent. FE Development Team <dl_javascript@nhnent.com>
 */
'use strict';
var util = global.tui.util;
var config = require('../../config');
var datetime = require('../../common/datetime');
var domutil = require('../../common/domutil');
var reqAnimFrame = require('../../common/reqAnimFrame');
var TZDate = require('../../common/timezone').Date;

/**
 * Class for Allday.Move dragging effect.
 * @constructor
 * @param {AlldayMove} alldayMove - instance of AlldayMove.
 */
function AlldayMoveGuide(alldayMove) {
    /**
     * @type {AlldayMove}
     */
    this.alldayMove = alldayMove;

    /**
     * 실제로 이벤트 엘리먼트를 담는 엘리먼트
     * @type {HTMLDIVElement}
     */
    this.scheduleContainer = null;

    /**
     * @type {number}
     */
    this._dragStartXIndex = null;

    /**
     * @type {HTMLDIVElement}
     */
    this.guideElement = null;

    /**
     * @type {HTMLElement[]}
     */
    this.elements = null;

    alldayMove.on({
        'alldayMoveDragstart': this._onDragStart,
        'alldayMoveDrag': this._onDrag,
        'alldayMoveDragend': this._clearGuideElement,
        'alldayMoveClick': this._clearGuideElement
    }, this);
}

/**
 * Destroy method
 */
AlldayMoveGuide.prototype.destroy = function() {
    this._clearGuideElement();
    this.alldayMove.off(this);
    this.alldayMove = this.scheduleContainer = this._dragStartXIndex =
        this.elements = this.guideElement = null;
};

/**
 * Clear guide element.
 */
AlldayMoveGuide.prototype._clearGuideElement = function() {
    domutil.remove(this.guideElement);

    if (!util.browser.msie) {
        domutil.removeClass(global.document.body, config.classname('dragging'));
    }

    this._dragStartXIndex = this.getScheduleDataFunc = this.guideElement = null;
};

/**
 * Dim element blocks
 * @param {number} modelID - Schedule model instance ID
 */
AlldayMoveGuide.prototype._hideOriginScheduleBlocks = function(modelID) {
    var className = config.classname('weekday-schedule-block-dragging-dim');
    var scheduleBlocks = domutil.find(
        config.classname('.weekday-schedule-block'),
        this.alldayMove.alldayView.container,
        true
    );

    this.elements = util.filter(scheduleBlocks, function(schedule) {
        return domutil.getData(schedule, 'id') === modelID;
    });

    util.forEach(this.elements, function(el) {
        domutil.addClass(el, className);
    });
};

/**
 * Show element blocks
 */
AlldayMoveGuide.prototype._showOriginScheduleBlocks = function() {
    var className = config.classname('weekday-schedule-block-dragging-dim');

    util.forEach(this.elements, function(el) {
        domutil.removeClass(el, className);
    });
};

/**
 * @param {Schedule} model - model
 * @param {HTMLElement} parent - parent element
 * Highlight element blocks
 */
AlldayMoveGuide.prototype._highlightScheduleBlocks = function(model, parent) {
    var elements = domutil.find(config.classname('.weekday-schedule'), parent, true);

    util.forEach(elements, function(el) {
        el.style.margin = '0';

        if (!model.isFocused) {
            el.style.backgroundColor = el.style.color;
            el.style.borderLeftColor = el.style.color;
            el.style.color = '#ffffff';
        }
    });
};


/**
 * Refresh guide element.
 * @param {number} leftPercent - left percent of guide element.
 * @param {number} widthPercent - width percent of guide element.
 * @param {boolean} isExceededLeft - schedule start is faster then render start date?
 * @param {boolean} isExceededRight - schedule end is later then render end date?
 */
AlldayMoveGuide.prototype.refreshGuideElement = function(leftPercent, widthPercent, isExceededLeft, isExceededRight) {
    var guideElement = this.guideElement;

    reqAnimFrame.requestAnimFrame(function() {
        guideElement.style.left = leftPercent + '%';
        guideElement.style.width = widthPercent + '%';

        if (isExceededLeft) {
            domutil.addClass(guideElement, config.classname('weekday-exceed-left'));
        } else {
            domutil.removeClass(guideElement, config.classname('weekday-exceed-left'));
        }

        if (isExceededRight) {
            domutil.addClass(guideElement, config.classname('weekday-exceed-right'));
        } else {
            domutil.removeClass(guideElement, config.classname('weekday-exceed-right'));
        }
    });
};

/**
 * Get schedule block information from schedule data.
 *
 * For example, there is single schedule has 10 length. but render range in view is 5 then
 * rendered block must be cut out to render properly. in this case, this method return
 * how many block are cut before rendering.
 *
 * 이벤트 데이터에서 이벤트 블록 엘리먼트 렌더링에 대한 필요 정보를 추출한다.
 *
 * ex) 렌더링 된 블록의 길이는 5지만 실제 이 이벤트는 10의 길이를 가지고 있을 때
 * 좌 우로 몇 만큼 잘려있는지에 관한 정보를 반환함.
 * @param {object} dragStartEventData - schedule data from Allday.Move handler.
 * @returns {function} function that return schedule block information.
 */
AlldayMoveGuide.prototype._getScheduleBlockDataFunc = function(dragStartEventData) {
    var model = dragStartEventData.model,
        datesInRange = dragStartEventData.datesInRange,
        range = dragStartEventData.range,
        baseWidthPercent = (100 / datesInRange),
        originScheduleStarts = datetime.start(model.start),
        originScheduleEnds = datetime.end(model.end),
        renderStartDate = datetime.start(range[0]),
        renderEndDate = datetime.end(range[range.length - 1]),
        fromLeft = (new TZDate(originScheduleStarts.getTime() -
            renderStartDate.getTime())) / datetime.MILLISECONDS_PER_DAY | 0,
        fromRight = (new TZDate(originScheduleEnds.getTime() -
            renderEndDate.getTime())) / datetime.MILLISECONDS_PER_DAY | 0;

    return function(indexOffset) {
        return {
            baseWidthPercent: baseWidthPercent,
            fromLeft: fromLeft + indexOffset,
            fromRight: fromRight + indexOffset
        };
    };
};

/**
 * DragStart event handler.
 * @param {object} dragStartEventData - schedule data.
 */
AlldayMoveGuide.prototype._onDragStart = function(dragStartEventData) {
    var alldayViewContainer = this.alldayMove.alldayView.container,
        guideElement = this.guideElement = dragStartEventData.scheduleBlockElement.cloneNode(true),
        scheduleContainer;

    if (!util.browser.msie) {
        domutil.addClass(global.document.body, config.classname('dragging'));
    }

    this._hideOriginScheduleBlocks(String(dragStartEventData.model.cid()));

    scheduleContainer = domutil.find(config.classname('.weekday-schedules'), alldayViewContainer);
    domutil.addClass(guideElement, config.classname('allday-guide-move'));
    scheduleContainer.appendChild(guideElement);

    this._dragStartXIndex = dragStartEventData.xIndex;
    this.getScheduleDataFunc = this._getScheduleBlockDataFunc(dragStartEventData);

    this._highlightScheduleBlocks(dragStartEventData.model, guideElement);
};

/**
 * Drag event handler.
 * @param {object} dragEventData - schedule data.
 */
AlldayMoveGuide.prototype._onDrag = function(dragEventData) {
    var getScheduleDataFunc = this.getScheduleDataFunc,
        dragStartXIndex = this._dragStartXIndex,
        datesInRange = dragEventData.datesInRange,
        scheduleData,
        isExceededLeft,
        isExceededRight,
        originLength,
        newLeft,
        newWidth;

    if (!getScheduleDataFunc) {
        return;
    }

    scheduleData = getScheduleDataFunc(dragEventData.xIndex - dragStartXIndex);
    isExceededLeft = scheduleData.fromLeft < 0;
    isExceededRight = scheduleData.fromRight > 0;

    newLeft = Math.max(0, scheduleData.fromLeft);
    originLength = (scheduleData.fromLeft * -1) + (datesInRange + scheduleData.fromRight);
    newWidth = isExceededLeft ? (originLength + scheduleData.fromLeft) : originLength;
    newWidth = isExceededRight ? (newWidth - scheduleData.fromRight) : newWidth;

    newLeft *= scheduleData.baseWidthPercent;
    newWidth *= scheduleData.baseWidthPercent;

    this.refreshGuideElement(newLeft, newWidth, isExceededLeft, isExceededRight);
};

module.exports = AlldayMoveGuide;

