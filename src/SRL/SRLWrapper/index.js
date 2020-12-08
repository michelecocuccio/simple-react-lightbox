import React, { useContext, useRef, useEffect, useState } from 'react'
import PropTypes from 'prop-types'
import { SRLCtx } from '../SRLContext'
import imagesLoaded from 'imagesloaded'

// IsEqual from lodash to do a deep comparison of the objects
const isEqual = require('lodash/isEqual')
const isEmpty = require('lodash/isEmpty')

const SRLWrapper = ({
  options,
  callbacks,
  images,
  children,
  defaultOptions,
  defaultCallbacks,
  customCaptions
}) => {
  // Imports the context
  const context = useContext(SRLCtx)

  // Sets a new Ref which will be used to target the div with the images
  const elementsContainer = useRef(null)
  // Ref for the mutation
  const mutationRef = useRef()

  const [imagesAreLoaded, setImagesAreLoaded] = useState(false)
  const [lightboxIsInit, setLightboxIsInit] = useState(false)

  useEffect(() => {
    // Mutation Observer
    mutationRef.current = new MutationObserver(detectChanges)

    // Detect if there are mutations in the SRLWrapper ref
    function detectChanges() {
      // if this runs there has been a mutation
      handleDetectTypeOfElements(elementsContainer.current)
    }

    // Declare what to observe
    mutationRef.current.observe(elementsContainer.current, {
      childList: true,
      subtree: true,
      attributeFilter: ['href', 'src']
    })

    // 4.5) Dispatch the action to grab the options
    function dispatchGrabSettings(options, callbacks, customCaptions) {
      // console.log('dispatched options')
      // We merge the settings that we receive from the user via the props with the original ones (defaultOptions and defaultCallbacks)
      // If the user hasn't provided any options/callbacks via props we make mergedSettings use just the default options/callbacks

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
          },
          translations: {
            ...defaultOptions.translations
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
          },
          translations: {
            ...defaultOptions.translations,
            ...options.translations
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
        callbacks: { ..._callbacks },
        customCaptions: [...customCaptions]
      }

      if (
        !isEqual(mergedSettings.options, context.options) ||
        !isEqual(mergedSettings.callbacks, context.callbacks)
      ) {
        context.dispatch({
          type: 'GRAB_SETTINGS',
          mergedSettings
        })
      }
    }

    // 4.5) Dispatch the action to handle the elements
    function dispatchAddElements(elements) {
      if (!isEqual(elements, context.elements)) {
        // console.log('dispatched grab elements')
        context.dispatch({
          type: 'GRAB_ELEMENTS',
          elements
        })
      }
    }

    // 4) Finally handle the lightbox by dispatching the actions to the context
    function handleLightBox(elements) {
      // Set the lightbox to be successfully initialized
      setLightboxIsInit(true)

      if (!lightboxIsInit) {
        // Dispatch the actions to grab settings and elements
        // console.log('light-box is initialized')
        return (
          dispatchAddElements(elements.filter((e) => e !== undefined)),
          dispatchGrabSettings(options, callbacks, customCaptions)
        )
      }
    }

    // 3.5) Dispatch the Action to handle the clicked item
    const handleElement = (element) => {
      // We don't want to dispatch the action if the selected image is already selected
      if (!isEqual(element, context.selectedElement)) {
        // console.log('dispatched grab element (single)')
        context.dispatch({
          type: 'HANDLE_ELEMENT',
          element
        })
      }
    }

    // 3.2.5) If the user passes the images via props, handle them
    function handleImagesPassedViaProps(array) {
      const elements = array.map((i, index) => {
        // Creates an object for each element
        const element = {
          source: i.src || null,
          thumbnail: i.thumbnail || i.src || null,
          caption: i.caption || null,
          id: `${index}`,
          width: 'auto',
          height: 'auto'
        }

        return element
      })

      // Function that handle the lightbox
      return handleLightBox(elements)
    }

    // 3) Adds the elements to the "context" and add the eventListener to open the lightbox to each element
    function handleImagesWithContext(array, elementType) {
      const elements = array.map((e, index) => {
        // If the images is loaded and not broken
        if (e.isLoaded) {
          e.img.setAttribute('srl-slide_id', index)
          // Check if it's an image
          const isImage = /\.(gif|jpg|jpeg|tiff|png|webp)$/i.test(
            e.img.currentSrc || e.img.src || e.img.href
          )

          /* Gatsby Images (Gatsby images creates two images, the first one is in base64 and we
          want to ignore that one but only if it's Gatsby because other base64 images are allowed)
          Also ignores images inside the <picture></picture> tag in Gatsby Images */
          const isBase64Image = e.img.src.includes('base64')
          const isSVGImage = e.img.src.includes('svg+xml')
          const isGatsbyImage = e.img.offsetParent?.className.includes(
            'gatsby-image-wrapper'
          )
          const isGatsbyPicture = e.img.parentNode.localName !== 'picture'

          if (
            isGatsbyImage &&
            (isBase64Image || isSVGImage) &&
            isGatsbyPicture
          ) {
            return
          }

          // Creates an object for each element
          const element = {
            // Grabs the "src" attribute from the image/video.
            // If it's a link grabs the "href" attribute
            // (in case of a gatsby image we need to go up to the wrapper Div and find the parent)
            source:
              elementType === 'IMG'
                ? e.img.currentSrc || e.img.src || e.img.href || null
                : e.img.parentElement.href ||
                  e.img.offsetParent.parentElement.href ||
                  null,

            thumbnail:
              elementType === 'IMG'
                ? e.img.currentSrc || e.img.src || e.img.href || null
                : e.img.currentSrc || e.img.parentElement.href || null,

            // Grabs the "alt" attribute from the image or the "textContent" from the video.
            // If it's a link grabs the "alt" attribute from the children image.
            caption: e.img.alt || e.img.textContent || null,
            // Grabs the newly created "id" attribute from the image/video
            // If it's a link grabs the "id" attribute from the children image.
            id: e.img.getAttribute('srl-slide_id') || null,
            // Grabs the "width" from the image/video
            // If it's a link we can't grab the width and we will need to calculate it after
            width: isImage
              ? e.img.naturalWidth || null
              : e.img.videoWidth || null,
            // Grabs the "height" from the image/video
            // If it's a link we can't grab the height and we will need to calculate it after.
            height: isImage
              ? e.img.naturalHeight || null
              : e.img.videoHeight || null
            // Generates a thumbnail image for the video otherwise set it to null
            // videoThumbnail: isImage ? null : generateScreen(e)
          }

          // Adds an event listener that will trigger the function to open the lightbox (passed using the Context)
          // If it's a link, assign the event listener to the link instead of the image
          if (elementType === 'A') {
            e.img.parentElement.addEventListener('click', (e) => {
              // Prevent the image from opening
              e.preventDefault()
              // Run the function to handle the clicked item
              handleElement(element)
            })
          } else {
            e.img.addEventListener('click', (e) => {
              // Prevent the image from opening
              e.preventDefault()
              // Run the function to handle the clicked item
              handleElement(element)
            })
          }

          // Return the image for the map function
          return element
        }
      })

      // Function that handle the lightbox
      return handleLightBox(elements)
    }

    // 2.5) When images are not loaded prevent them from being clicked
    function handleLightboxNotLoaded(array) {
      Array.from(array).map((e) =>
        e.addEventListener('click', (event) => {
          event.preventDefault()
        })
      )
    }

    // 2) Detected if images are loaded in the DOM
    function handleImagesLoaded(array) {
      // Checks if the images are loaded using "imagesLoaded" by Desandro (❤️)
      // When te images are loaded set the state to TRUE and run the function to handle the context
      if (!imagesAreLoaded) {
        // If images are still loading
        handleLightboxNotLoaded(array)
      }
      imagesLoaded(array, function (instance) {
        if (instance.isComplete) {
          // Checks if the element (the first one) is an image or a link. If it's a link, the user is using the gallery
          // And we need to grab the correct source of the image, not the thumbnail
          const elementType = instance.elements[0].nodeName
          if (!imagesAreLoaded) {
            setImagesAreLoaded(true)
            handleImagesWithContext(instance.images, elementType)
          }
        }
      })
    }

    // 1) Detected the type of element (if the user is using the "GALLERY" approach)
    function handleDetectTypeOfElements(array) {
      if (!array) {
        return;
      }

      // Grabs images in the ref
      const collectedElements = array.querySelectorAll('img')
      // Filtered collected elemenets is used to exclude Gatsby images inside the <picture></picture> tag
      // const filteredCollectedElements = Array.from(collectedElements).filter(
      //   (e) => {
      //     console.log(
      //       e.parentNode.offsetParent.className.includes('gatsby-image-wrapper')
      //     )
      //     return (
      //       e.parentNode?.localName !== 'picture' &&
      //       !e.parentNode?.offsetParent?.className.includes(
      //         'gatsby-image-wrapper'
      //       )
      //     )
      //   }
      // )
      // Grabs data attributes (in links) in the ref
      const collectedDataAttributes = array.querySelectorAll(
        "a[data-attribute='SRL']"
      )

      // Checks if the are elements in the DOM first of all
      if (collectedElements.length !== 0) {
        if (collectedDataAttributes.length === 0) {
          // USER IS NOT USING DATA ATTRIBUTES
          handleImagesLoaded(collectedElements)
        } else if (collectedDataAttributes.length > 0) {
          // USER *IS* USING DATA ATTRIBUTES
          handleImagesLoaded(collectedDataAttributes)
          /* Throws a warning if the number of links is not equal to the number of images so that means
          that the user has forgot to add a "a[data-attribute='SRL']" to one or more images */

          // if (
          //   collectedDataAttributes.length !== filteredCollectedElements.length
          // ) {
          //   console.warn(
          //     `HEY!. You have ${collectedDataAttributes.length} links and ${filteredCollectedElements.length} images. You likely forgot to add the ** data-attribute="SRL" ** to one of your link wrapping your image!`
          //   )
          // }
        }
      }
      // USER IS DECLARING IMAGES VIA PROPS
      else {
        if (images) {
          handleImagesPassedViaProps(images)
        }
      }
    }

    // RUN THE LIGHTBOX
    handleDetectTypeOfElements(elementsContainer.current)
  }, [
    lightboxIsInit,
    context,
    imagesAreLoaded,
    defaultCallbacks,
    defaultOptions,
    options,
    callbacks,
    images,
    customCaptions
  ])

  return <div ref={elementsContainer}>{children}</div>
}

export default SRLWrapper

SRLWrapper.propTypes = {
  defaultOptions: PropTypes.shape({
    settings: PropTypes.shape({
      autoplaySpeed: PropTypes.number,
      disableKeyboardControls: PropTypes.bool,
      disablePanzoom: PropTypes.bool,
      disableWheelControls: PropTypes.bool,
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
      ])
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
      thumbnailsOpacity: PropTypes.number,
      thumbnailsPosition: PropTypes.string,
      thumbnailsSize: PropTypes.array
    }),
    progressBar: PropTypes.shape({
      backgroundColor: PropTypes.string,
      fillColor: PropTypes.string,
      height: PropTypes.string,
      showProgressBar: PropTypes.bool
    }),
    translations: PropTypes.shape({
      autoplayText: PropTypes.string,
      closeText: PropTypes.string,
      downloadText: PropTypes.string,
      fullscreenText: PropTypes.string,
      nextText: PropTypes.string,
      pauseText: PropTypes.string,
      previousText: PropTypes.string,
      thumbnailsText: PropTypes.string,
      zoomOutText: PropTypes.string
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
  images: PropTypes.array,
  customCaptions: PropTypes.array
}

SRLWrapper.defaultProps = {
  defaultOptions: {
    settings: {
      autoplaySpeed: 3000,
      disableKeyboardControls: false,
      disablePanzoom: false,
      disableWheelControls: false,
      hideControlsAfter: 3000,
      lightboxTransitionSpeed: 0.3,
      lightboxTransitionTimingFunction: 'linear',
      overlayColor: 'rgba(0, 0, 0, 0.9)',
      slideAnimationType: 'fade',
      slideSpringValues: [300, 200],
      slideTransitionSpeed: 0.6,
      slideTransitionTimingFunction: 'linear'
    },
    buttons: {
      backgroundColor: 'rgba(30,30,36,0.8)',
      iconColor: 'rgba(255, 255, 255, 0.8)',
      iconPadding: '5px',
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
      captionContainerPadding: '0',
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
      thumbnailsOpacity: 0.4,
      thumbnailsPosition: 'bottom',
      thumbnailsSize: ['100px', '80px']
    },
    progressBar: {
      backgroundColor: '#f2f2f2',
      fillColor: '#000000',
      height: '3px',
      showProgressBar: true
    },
    translations: {
      autoplayText: 'Play',
      closeText: 'Close',
      downloadText: 'Download',
      fullscreenText: 'Full screen',
      nextText: 'Next',
      pauseText: 'Pause',
      previousText: 'Previous',
      thumbnailsText: 'Hide thumbnails',
      zoomOutText: 'Zoom Out'
    }
  },
  defaultCallbacks: {
    onCountSlides: () => {},
    onSlideChange: () => {},
    onLightboxClosed: () => {},
    onLightboxOpened: () => {}
  },
  customCaptions: [{}]
}
