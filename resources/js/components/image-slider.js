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
            $counter.text('').hide();
        }
        if ($prev.length) {
            $prev.prop('disabled', true).hide().off('click.slider');
        }
        if ($next.length) {
            $next.prop('disabled', true).hide().off('click.slider');
        }
        $container.css('display', 'none');
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
            $img.attr('src', url).show();
        }
        if ($counter.length) {
            $counter.text(`${index + 1} / ${total}`);
            $counter.css('display', total > 0 ? 'block' : 'none');
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
    };

    const go = (delta) => {
        index = (index + delta + total) % total;
        update();
    };

    if ($prev.length) {
        $prev.off('click.slider').on('click.slider', (event) => {
            event.preventDefault();
            go(-1);
        });
    }
    if ($next.length) {
        $next.off('click.slider').on('click.slider', (event) => {
            event.preventDefault();
            go(1);
        });
    }

    $container.css('display', 'flex');
    $container.data('sliderUrls', urls);
    update();
}

