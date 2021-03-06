import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import pdfjs from 'pdfjs-dist';

import PageContext from '../PageContext';

import { isPage, isRotate } from '../shared/propTypes';

export class TextLayerItemInternal extends PureComponent {
  componentDidMount() {
    this.alignTextItem();
  }

  componentDidUpdate() {
    this.alignTextItem();
  }

  get unrotatedViewport() {
    const { page, scale } = this.props;

    return page.getViewport({ scale });
  }

  /**
   * It might happen that the page is rotated by default. In such cases, we shouldn't rotate
   * text content.
   */
  get rotate() {
    const { page, rotate } = this.props;
    return rotate - page.rotate;
  }

  get sideways() {
    const { rotate } = this;
    return rotate % 180 !== 0;
  }

  get angle() {
    const { transform } = this.props;

    const tx = pdfjs.Util.transform(this.unrotatedViewport.transform, transform);
    let angle = Math.atan2(tx[1], tx[0]);

    if (angle !== 0) {
      angle *= (180 / Math.PI);
    }

    return angle;
  }

  get defaultSideways() {
    const { rotation } = this.unrotatedViewport;
    return rotation % 180 !== 0;
  }

  get isTextSideways() {
    const { rotation } = this.unrotatedViewport;
    const rotationWithText = rotation + this.angle;
    return rotationWithText % 180 !== 0;
  }

  get fontSize() {
    const { transform } = this.props;
    const { isTextSideways } = this;
    const [fontHeightPx, fontWidthPx] = transform;
    return isTextSideways ? fontWidthPx : fontHeightPx;
  }

  get top() {
    const { transform } = this.props;
    const { unrotatedViewport: viewport, defaultSideways } = this;
    const [/* fontHeightPx */, /* fontWidthPx */, offsetX, offsetY, x, y] = transform;
    const [/* xMin */, yMin, /* xMax */, yMax] = viewport.viewBox;
    return defaultSideways ? x + offsetX + yMin : yMax - (y + offsetY);
  }

  get left() {
    const { transform } = this.props;
    const { unrotatedViewport: viewport, defaultSideways } = this;
    const [/* fontHeightPx */, /* fontWidthPx */, /* offsetX */, /* offsetY */, x, y] = transform;
    const [xMin] = viewport.viewBox;
    return defaultSideways ? y - xMin : x - xMin;
  }

  async getFontData(fontName) {
    const { page } = this.props;

    const font = await new Promise((resolve) => {
      page.commonObjs.get(fontName, resolve);
    });

    return font;
  }

  async alignTextItem() {
    const element = this.item;

    if (!element) {
      return;
    }

    element.style.transform = '';

    const { fontName, scale, width } = this.props;

    element.style.fontFamily = `${fontName}, sans-serif`;

    const fontData = await this.getFontData(fontName);

    const fallbackFontName = fontData ? fontData.fallbackName : 'sans-serif';
    element.style.fontFamily = `${fontName}, ${fallbackFontName}`;

    const targetWidth = width * scale;
    const actualWidth = this.getElementWidth(element);

    let transform = `scaleX(${targetWidth / actualWidth})`;

    const ascent = fontData ? fontData.ascent : 0;
    if (ascent) {
      transform += ` translateY(${(1 - ascent) * 100}%)`;
    }
    if (this.angle !== 0) {
      transform += ` rotate(${this.angle}deg)`;
    }

    element.style.transform = transform;
  }

  getElementWidth = (element) => {
    const { sideways } = this;
    return element.getBoundingClientRect()[sideways ? 'height' : 'width'];
  };

  render() {
    const { fontSize, top, left } = this;
    const { customTextRenderer, scale, str: text } = this.props;

    return (
      <span
        style={{
          height: '1em',
          fontFamily: 'sans-serif',
          fontSize: `${fontSize * scale}px`,
          position: 'absolute',
          top: `${top * scale}px`,
          left: `${left * scale}px`,
          transformOrigin: 'left bottom',
          whiteSpace: 'pre',
          pointerEvents: 'all',
        }}
        ref={(ref) => { this.item = ref; }}
      >
        {
          customTextRenderer
            ? customTextRenderer(this.props)
            : text
        }
      </span>
    );
  }
}

TextLayerItemInternal.propTypes = {
  customTextRenderer: PropTypes.func,
  fontName: PropTypes.string.isRequired,
  itemIndex: PropTypes.number.isRequired, // eslint-disable-line react/no-unused-prop-types
  page: isPage.isRequired,
  rotate: isRotate,
  scale: PropTypes.number,
  str: PropTypes.string.isRequired,
  transform: PropTypes.arrayOf(PropTypes.number).isRequired,
  width: PropTypes.number.isRequired,
};

const TextLayerItem = props => (
  <PageContext.Consumer>
    {context => <TextLayerItemInternal {...context} {...props} />}
  </PageContext.Consumer>
);

export default TextLayerItem;
