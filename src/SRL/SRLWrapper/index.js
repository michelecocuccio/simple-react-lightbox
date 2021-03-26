import React, { useContext, useRef, useEffect } from 'react'
import PropTypes from 'prop-types'
import { SRLCtx } from '../SRLContext'
import { loadImages } from './utils'
import {
  READY_LIGHTBOX,
  RESET_LIGHTBOX,
  HANDLE_ELEMENT
} from '../SRLContext/actions'
import { GALLERY_IMAGE, IMAGE } from './element_types'
import { dispatchError } from '../SRLErrors'
import { handleAttachListener } from './utils'
import {
  isSimpleImage,
  isGatsbyGalleryImage,
  isGalleryImage,
  isImageByUser
} from './detect_types'
// IsEqual from lodash to do a deep comparison of the objects
import isEqual from 'lodash.isequal'
import isEmpty from 'lodash.isempty'

const SRLWrapper = ({
  options,
  callbacks,
  elements,
  children,
  defaultOptions,
  defaultCallbacks
}) => {
  // Imports the context
  const context = useContext(SRLCtx)

  // Sets a new Ref which will be used to target the div with the images
  const elementsContainer = useRef(null)
  // Ref for the mutation
  const mutationRef = useRef()
  /* mountedRef is used here to indicate if the component is still mounted.
  If so, we can continue any async call otherwise, skip them. */
  const mountedRef = useRef(true)

  /* RESET THE LIGHTBOX STATUS */
  useEffect(() => {
    try {
      // console.log('RESET')
      context.dispatch({
        type: RESET_LIGHTBOX
      })
    } catch (error) {
      const message = (error.message =
        'SRL - ERROR WHEN RESETTING THE LIGHTBOX STATUS')
      dispatchError(message)
    }
    return () => {
      mountedRef.current = false
    }
  }, [])

  useEffect(() => {
    /* STARTS SIMPLE REACT LIGHTBOX */

    function handleSRL(array) {
      if (!array) {
        return
      }

      // Grabs images inside the ref
      const collectedElements = array.querySelectorAll('img')
      // Checks if the are elements in the DOM
      if (collectedElements.length > 0) {
        if (!context.isLoaded) {
          handleImagesLoaded(collectedElements)
          // preventDefault on elements inside the ref
          Array.from(collectedElements).map((e) =>
            e.addEventListener('click', (event) => {
              event.preventDefault()
            })
          )
        }
      }
      // User is declaring images via prop
      else {
        if (elements) {
          handleElementsPassedViaProps(elements)
        }
      }
    }

    /* HANDLE ELEMENTS PASSED BY THE USER VIA PROPS */
    function handleElementsPassedViaProps(array) {
      const elements = array
        .map((e, index) => {
          if (isImageByUser(e)) {
            return {
              id: index + '',
              source: e.src || null,
              caption: e.caption || null,
              thumbnail: e.thumbnail || e.src || null,
              type: 'image'
            }
          } else {
            return undefined
          }
        })
        .filter((e) => e && !e.src)

      // Function that handle the lightbox
      return handleLightBox(elements)
    }

    /* CREATES AN ARRAY OF IMAGES */
    function handleCreateElements(allImgs) {
      let elements = []
      allImgs.forEach((e) => {
        if (isGalleryImage(e) || isGatsbyGalleryImage(e)) {
          elements = [
            ...elements,
            {
              type: GALLERY_IMAGE,
              element: e
            }
          ]
        } else if (isSimpleImage(e)) {
          elements = [
            ...elements,
            {
              type: IMAGE,
              element: e
            }
          ]
        } else {
          elements = [...elements]
        }
      })
      handleElements(elements)
    }

    /* DETECTS IF IMAGES ARE LOADED IN THE DOM AND ARE NOT BROKEN */
    function handleImagesLoaded(allElements) {
      return loadImages(allElements).then(function (allImgs) {
        if (!mountedRef.current) return null
        return handleCreateElements(allImgs)
      })
    }

    /* DISPATCH THE ACTION TO HANDLE THE ELEMENT */
    const handleElement = (element) => {
      // We don't want to dispatch the action if the selected image is already selected
      if (!isEqual(element, context.selectedElement)) {
        // console.log('dispatched grab element (single)')
        try {
          // console.log('HANDLE ELEMENT')
          context.dispatch({
            type: HANDLE_ELEMENT,
            element
          })
        } catch (error) {
          const message = (error.message =
            'SRL - ERROR WHEN HANDLING THE ELEMENT')
          dispatchError(message)
        }
      }
    }

    /* ADDS ELEMENTS TO THE CONTEXT AND ATTACH AN EVENT LISTENER TO EACH */
    function handleElements(data) {
      let elementId = 0
      const elements = data
        .map(({ element: e, type }) => {
          e.setAttribute('srl_elementid', elementId)
          /* Gatsby Images (Gatsby images creates two images, the first one is in base64 and we
          want to ignore that one but only if it's Gatsby because other base64 images are allowed)
          Also ignores images inside the <picture></picture> tag in Gatsby Images */
          const isBase64Image = e.src?.includes('base64')
          const isSVGImage = e.src?.includes('svg+xml')
          const isGatsbyImage = e.offsetParent?.className.includes(
            'gatsby-image-wrapper'
          )
          const isGatsbyPicture = e.parentNode?.localName !== 'picture'

          /* Next.js version 10 include an Image component which has a div with another image with a role of presentation that shouldn't be included */
          const isNextJsImage = e.getAttribute('role') === 'presentation'
          const isNextJsTransparentImage = e.src?.includes(
            'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'
          )

          if (
            (isGatsbyImage &&
              (isBase64Image || isSVGImage) &&
              isGatsbyPicture) ||
            isNextJsImage ||
            isNextJsTransparentImage
          ) {
            return undefined
          } else {
            elementId++
            switch (type) {
              case IMAGE: {
                const element = {
                  id: e.getAttribute('srl_elementid'),
                  source: e.currentSrc || e.src,
                  caption: e.alt,
                  thumbnail: e.currentSrc || e.src,
                  width: e.naturalWidth,
                  height: e.naturalHeight,
                  type: 'image'
                }
                handleAttachListener(e, element, handleElement)
                return element
              }
              case GALLERY_IMAGE: {
                const element = {
                  id: e.getAttribute('srl_elementid'),
                  source:
                    e.parentElement.href ||
                    e.offsetParent.parentElement.href ||
                    e.offsetParent.href ||
                    e.parentElement.parentElement.parentElement.href || // UGLY FIX FOR GATSBY
                    null,
                  caption: e.alt || e.textContent,
                  thumbnail: e.currentSrc || e.src || e.parentElement.href,
                  width: null,
                  height: null,
                  type: 'gallery_image'
                }

                handleAttachListener(e, element, handleElement)
                return element
              }
              default: {
                return undefined
              }
            }
          }
        })
        .filter((e) => e !== undefined)

      // Adds elements to the context
      return handleLightBox(elements)
    }

    /* DISPATCH AN ACTION TO GRAB ALL THE ELEMENTS AND THE SETTINGS AND READY THE LIGHTBOX */
    function dispatchLightboxReady(options, callbacks, elements) {
      let _options = {}
      let _callbacks = {}

      if (isEmpty(options)) {
        _options = {
          ...defaultOptions,
          buttons: {
            ...defaultOptions.buttons
          },
          settings: {
            ...defaultOptions.settings
          },
          caption: {
            ...defaultOptions.caption
          },
          thumbnails: {
            ...defaultOptions.thumbnails
          },
          progressBar: {
            ...defaultOptions.progressBar
          }
        }
      } else {
        _options = {
          ...defaultOptions,
          ...options,
          buttons: {
            ...defaultOptions.buttons,
            ...options.buttons
          },
          settings: {
            ...defaultOptions.settings,
            ...options.settings
          },
          caption: {
            ...defaultOptions.caption,
            ...options.caption
          },
          thumbnails: {
            ...defaultOptions.thumbnails,
            ...options.thumbnails
          },
          progressBar: {
            ...defaultOptions.progressBar,
            ...options.progressBar
          }
        }
      }

      if (isEmpty(callbacks)) {
        _callbacks = { ...defaultCallbacks }
      } else {
        _callbacks = { ...defaultCallbacks, ...callbacks }
      }

      const mergedSettings = {
        options: { ..._options },
        callbacks: { ..._callbacks }
      }

      if (
        !isEqual(mergedSettings.options, context.options) ||
        !isEqual(mergedSettings.callbacks, context.callbacks) ||
        !isEqual(elements, context.elements)
      ) {
        try {
          // console.log('READY')
          context.dispatch({
            type: READY_LIGHTBOX,
            mergedSettings,
            elements
          })
        } catch (error) {
          const message = (error.message =
            'SRL - ERROR GRABBING SETTINGS AND ELEMENTS')
          dispatchError(message)
        }
      }
    }

    /* HANDLE THE LIGHTBOX BY DISPATCHING THE TWO ACTIONS */
    function handleLightBox(elements) {
      // Dispatch the actions to grab settings and elements
      // console.log('light-box is initialized')
      return dispatchLightboxReady(options, callbacks, elements)
    }

    /* DETECTS IF THERE ARE MUTATIONS IN THE REF  */
    mutationRef.current = new MutationObserver(detectChanges)
    function detectChanges() {
      // if this runs there has been a mutation
      handleSRL(elementsContainer.current)
    }

    /* OBSERVE THE MUTATION */
    mutationRef.current.observe(elementsContainer.current, {
      childList: true,
      subtree: true,
      attributeFilter: ['href', 'src']
    })

    // RUN THE LIGHTBOX
    handleSRL(elementsContainer.current)
  }, [context, defaultCallbacks, defaultOptions, options, callbacks, elements])

  return <div ref={elementsContainer}>{children}</div>
}

export default SRLWrapper

SRLWrapper.propTypes = {
  defaultOptions: PropTypes.shape({
    settings: PropTypes.shape({
      autoplaySpeed: PropTypes.number,
      boxShadow: PropTypes.string,
      disableKeyboardControls: PropTypes.bool,
      disablePanzoom: PropTypes.bool,
      disableWheelControls: PropTypes.bool,
      downloadedFileName: PropTypes.string,
      hideControlsAfter: PropTypes.oneOfType([
        PropTypes.number,
        PropTypes.bool
      ]),
      lightboxTransitionSpeed: PropTypes.number,
      lightboxTransitionTimingFunction: PropTypes.oneOfType([
        PropTypes.string,
        PropTypes.array
      ]),
      overlayColor: PropTypes.string,
      slideAnimationType: PropTypes.string,
      slideSpringValues: PropTypes.array,
      slideTransitionSpeed: PropTypes.number,
      slideTransitionTimingFunction: PropTypes.oneOfType([
        PropTypes.string,
        PropTypes.array
      ]),
      usingPreact: PropTypes.bool
    }),
    buttons: PropTypes.shape({
      backgroundColor: PropTypes.string,
      iconColor: PropTypes.string,
      iconPadding: PropTypes.string,
      showAutoplayButton: PropTypes.bool,
      showCloseButton: PropTypes.bool,
      showDownloadButton: PropTypes.bool,
      showFullscreenButton: PropTypes.bool,
      showNextButton: PropTypes.bool,
      showPrevButton: PropTypes.bool,
      showThumbnailsButton: PropTypes.bool,
      size: PropTypes.string
    }),
    caption: PropTypes.shape({
      captionColor: PropTypes.string,
      captionAlignment: PropTypes.string,
      captionFontFamily: PropTypes.string,
      captionFontSize: PropTypes.string,
      captionFontStyle: PropTypes.string,
      captionFontWeight: PropTypes.oneOfType([
        PropTypes.number,
        PropTypes.string
      ]),
      captionContainerPadding: PropTypes.string,
      captionTextTransform: PropTypes.string,
      showCaption: PropTypes.bool
    }),
    thumbnails: PropTypes.shape({
      showThumbnails: PropTypes.bool,
      thumbnailsAlignment: PropTypes.string,
      thumbnailsContainerPadding: PropTypes.string,
      thumbnailsContainerBackgroundColor: PropTypes.string,
      thumbnailsGap: PropTypes.string,
      thumbnailsIconColor: PropTypes.string,
      thumbnailsOpacity: PropTypes.number,
      thumbnailsPosition: PropTypes.string,
      thumbnailsSize: PropTypes.array
    }),
    progressBar: PropTypes.shape({
      backgroundColor: PropTypes.string,
      fillColor: PropTypes.string,
      height: PropTypes.string,
      showProgressBar: PropTypes.bool
    })
  }),
  defaultCallbacks: PropTypes.shape({
    onCountSlides: PropTypes.func,
    onLightboxClosed: PropTypes.func,
    onLightboxOpened: PropTypes.func,
    onSlideChange: PropTypes.func
  }),
  children: PropTypes.oneOfType([
    PropTypes.arrayOf(PropTypes.node),
    PropTypes.node
  ]),
  options: PropTypes.object,
  callbacks: PropTypes.object,
  elements: PropTypes.array
}

SRLWrapper.defaultProps = {
  defaultOptions: {
    settings: {
      autoplaySpeed: 3000,
      boxShadow: 'none',
      disableKeyboardControls: false,
      disablePanzoom: false,
      disableWheelControls: false,
      downloadedFileName: 'SRL-image',
      hideControlsAfter: false,
      lightboxTransitionSpeed: 0.3,
      lightboxTransitionTimingFunction: 'linear',
      overlayColor: 'rgba(30, 30, 30, 0.9)',
      slideAnimationType: 'fade',
      slideSpringValues: [300, 50],
      slideTransitionSpeed: 0.6,
      slideTransitionTimingFunction: 'linear',
      usingPreact: false
    },
    buttons: {
      backgroundColor: 'rgba(30,30,36,0.8)',
      iconColor: 'rgba(255, 255, 255, 0.8)',
      iconPadding: '10px',
      showAutoplayButton: true,
      showCloseButton: true,
      showDownloadButton: true,
      showFullscreenButton: true,
      showNextButton: true,
      showPrevButton: true,
      showThumbnailsButton: true,
      size: '40px'
    },
    caption: {
      captionAlignment: 'start',
      captionColor: '#FFFFFF',
      captionContainerPadding: '20px 0 30px 0',
      captionFontFamily: 'inherit',
      captionFontSize: 'inherit',
      captionFontStyle: 'inherit',
      captionFontWeight: 'inherit',
      captionTextTransform: 'inherit',
      showCaption: true
    },
    thumbnails: {
      showThumbnails: true,
      thumbnailsAlignment: 'center',
      thumbnailsContainerBackgroundColor: 'transparent',
      thumbnailsContainerPadding: '0',
      thumbnailsGap: '0 1px',
      thumbnailsIconColor: '#ffffff',
      thumbnailsOpacity: 0.4,
      thumbnailsPosition: 'bottom',
      thumbnailsSize: ['100px', '80px']
    },
    progressBar: {
      backgroundColor: '#f2f2f2',
      fillColor: '#000000',
      height: '3px',
      showProgressBar: true
    }
  },
  defaultCallbacks: {
    onCountSlides: () => {},
    onSlideChange: () => {},
    onLightboxClosed: () => {},
    onLightboxOpened: () => {}
  }
}
