/**
 * Image Slider Component
 * Handles image preview slider in modals
 */

/**
 * Render image slider
 */
export function renderImageSlider($container, urls) {
    if (!$container || !$container.length) {
        return;
    }

    const $img = $container.find('.aiassistant-image-slider-img');
    const $counter = $container.find('.aiassistant-image-slider-counter');
    const $prev = $container.find('.aiassistant-image-slider-button.prev');
    const $next = $container.find('.aiassistant-image-slider-button.next');

    const cleanUp = () => {
        if ($img.length) {
            $img.attr('src', '').hide();
        }
        if ($counter.length) {
            $counter.text('').addClass('aiassistant-hidden').hide();
        }
        if ($prev.length) {
            $prev.prop('disabled', true).hide().off('click.slider');
        }
        if ($next.length) {
            $next.prop('disabled', true).hide().off('click.slider');
        }
        $container.addClass('aiassistant-hidden').css('display', 'none');
        $container.removeData('sliderUrls').removeData('sliderIndex');
        $container.off('click.sliderSave');
    };

    if (!urls || !urls.length) {
        cleanUp();
        return;
    }

    let index = 0;
    const total = urls.length;

    const update = () => {
        const url = urls[index] || '';
        if ($img.length) {
            // Set image source and ensure it's visible
            $img.attr('src', url).addClass('show').show();
            
            // Ensure image loads and fits properly
            $img.on('load', function() {
                $(this).addClass('show');
            });
        }
        if ($counter.length) {
            $counter.text(`${index + 1} / ${total}`);
            if (total > 1) {
                $counter.removeClass('aiassistant-hidden').css('display', 'block');
            } else {
                $counter.addClass('aiassistant-hidden').css('display', 'none');
            }
        }
        if ($prev.length) {
            $prev.prop('disabled', total <= 1);
            $prev.css('display', total > 1 ? 'flex' : 'none');
        }
        if ($next.length) {
            $next.prop('disabled', total <= 1);
            $next.css('display', total > 1 ? 'flex' : 'none');
        }
        $container.data('sliderIndex', index);
        $container.data('sliderUrls', urls);
    };

    const go = (delta) => {
        index = (index + delta + total) % total;
        update();
    };

    if ($prev.length) {
        $prev.off('click.slider').on('click.slider', (event) => {
            event.preventDefault();
            event.stopPropagation();
            go(-1);
        });
    }
    if ($next.length) {
        $next.off('click.slider').on('click.slider', (event) => {
            event.preventDefault();
            event.stopPropagation();
            go(1);
        });
    }

    // Show the container by removing hidden class and setting display
    $container.removeClass('aiassistant-hidden').css('display', 'flex');
    $container.data('sliderUrls', urls);
    update();
}

