import './jquery-global.js';

import InfiniteScroll from 'infinite-scroll';
import fitvids from 'fitvids';
import 'lazysizes';

import Glide from '@glidejs/glide';
import Alpine from 'alpinejs';
import 'flowbite';

window.Alpine = Alpine;
Alpine.start();

var body = $('body');
var timeout;
var st = 0;
var lastSt = 0;
var titleOffset = 0;
var contentOffset = 0;
var progress = $('.sticky-progress');

$(function () {
    subMenu();
    featured();
    partners();
    featuredBy();
    pagination();
    video();
    gallery();
    table();
    // modal();
    // search();
    burger();
    colourTags();
    contentDropdown();
    tagContentFilter();
});

$(window).on('scroll', function () {
    if (body.hasClass('post-template')) {
        if (timeout) {
            window.cancelAnimationFrame(timeout);
        }
        timeout = window.requestAnimationFrame(sticky);
    }
});

$(window).on('load', function () {
    if (body.hasClass('post-template')) {
        titleOffset = $('.single-title').offset().top;

        var content = $('.single-content');
        var contentHeight = content.height();
        contentOffset =
            content.offset().top + contentHeight - $(window).height() / 2;
    }
});

function sticky() {
    st = jQuery(window).scrollTop();

    if (titleOffset > 0 && contentOffset > 0) {
        if (st > lastSt) {
            if (st > titleOffset) {
                body.addClass('sticky-visible');
            }
        } else {
            if (st <= titleOffset) {
                body.removeClass('sticky-visible');
            }
        }
    }

    progress.css(
        'transform',
        'translate3d(' +
            (-100 + Math.min((st * 100) / contentOffset, 100)) +
            '%,0,0)',
    );

    lastSt = st;
}

function subMenu() {
    var mainNav = $('.main-nav');
    var separator = mainNav.find('.menu-item[href*="..."]');

    if (separator.length) {
        separator.nextAll('.menu-item').wrapAll('<div class="sub-menu" />');
        separator.replaceWith(
            '<button class="button-icon menu-item-button menu-item-more" aria-label="More"><svg class="icon"><use xlink:href="#dots-horizontal"></use></svg></button>',
        );

        var toggle = mainNav.find('.menu-item-more');
        var subMenu = $('.sub-menu');
        toggle.append(subMenu);

        toggle.on('click', function () {
            if (!subMenu.is(':visible')) {
                subMenu.show().addClass('animate__animated animate__bounceIn');
            } else {
                subMenu.addClass('animate__animated animate__zoomOut');
            }
        });

        subMenu.on('animationend', function (e) {
            subMenu.removeClass(
                'animate__animated animate__bounceIn animate__zoomOut',
            );
            if (e.originalEvent.animationName == 'zoomOut') {
                subMenu.hide();
            }
        });
    }
}

function featured() {
    var glideFeed;

    function initializeGlide() {
        glideFeed = new Glide('.featured-feed', {
            type: 'carousel',
            autoplay: 3500,
            perView: 1,
            breakpoints: {
                576: { perView: 1 },
                768: { perView: 1 },
                992: { perView: 1 },
                1200: { perView: 1 },
                1400: { perView: 1 },
            },
        });

        $('.featured-prev').on('click', function () {
            glideFeed.go('<');
        });

        $('.featured-next').on('click', function () {
            glideFeed.go('>');
        });

        glideFeed.on(['mount.after', 'run'], function () {
            glideFeed.update({ perView: 1 });
        });

        glideFeed.mount();
    }

    function destroyGlide() {
        if (glideFeed) {
            glideFeed.destroy();
        }
    }

    // Debounce function to limit the rate at which the resize function is called
    function debounce(func, delay) {
        var timer;
        return function () {
            var context = this;
            var args = arguments;
            clearTimeout(timer);
            timer = setTimeout(function () {
                func.apply(context, args);
            }, delay);
        };
    }

    // Initialize Glide after DOM is fully loaded
    document.addEventListener('DOMContentLoaded', function () {
        initializeGlide();
    });

    // Debounced refresh of Glide on window resize
    var debouncedResize = debounce(function () {
        if (glideFeed) {
            destroyGlide();
            initializeGlide();
        }
    }, 200);

    // Attach the debounced function to the window resize event
    $(window).on('resize', debouncedResize);
}

featured();

function partners() {
    if (body.find('.partners-feed').length === 0) {
        return;
    }

    var glideFeed = new Glide('.partners-feed', {
        type: 'carousel',
        autoplay: 3500,
        perView: 4,
        breakpoints: {
            768: {
                perView: 2,
            },
        },
    });
    glideFeed.mount();
}

function featuredBy() {
    if (body.find('.featuredby-feed').length === 0) {
        return;
    }

    var glideFeed = new Glide('.featuredby-feed', {
        type: 'carousel',
        perView: 3,
    });
    glideFeed.mount();
}

function pagination() {
    if (body.hasClass('paged-next')) {
        new InfiniteScroll('.post-feed', {
            append: '.feed-card',
            button: '.infinite-scroll-button',
            debug: false,
            hideNav: '.pagination',
            history: false,
            path: '.pagination .older-posts',
            scrollThreshold: false,
            status: '.infinite-scroll-status',
        });
    }
}

function video() {
    fitvids('.single-content');
}

function gallery() {
    const images = document.querySelectorAll('.kg-gallery-image img');
    images.forEach((image) => {
        const container = image.closest('.kg-gallery-image');
        const width = image.attributes.width.value;
        const height = image.attributes.height.value;
        const ratio = width / height;
        container.style.flex = ratio + ' 1 0%';
    });
}

function table() {
    if (body.hasClass('post-template') || body.hasClass('page-template')) {
        var tables = $('.single-content').find('.table');
        tables.each(function (_, table) {
            var labels = [];

            $(table)
                .find('thead th')
                .each(function (_, label) {
                    labels.push($(label).text());
                });

            $(table)
                .find('tr')
                .each(function (_, row) {
                    $(row)
                        .find('td')
                        .each(function (index, column) {
                            $(column).attr('data-label', labels[index]);
                        });
                });
        });
    }
}

/*
function modal() {
    var modalOverlay = $('.modal-overlay');
    var modal = $('.modal');
    var modalInput = $('.modal-input');

    $('.js-modal').on('click', function (e) {
        e.preventDefault();
        modalOverlay.show().outerWidth();
        body.addClass('modal-opened');
        modalInput.focus();
    });

    $('.modal-close, .modal-overlay').on('click', function () {
        body.removeClass('modal-opened');
    });

    modal.on('click', function (e) {
        e.stopPropagation();
    });

    $(document).keyup(function (e) {
        if (e.keyCode === 27 && body.hasClass('modal-opened')) {
            body.removeClass('modal-opened');
        }
    });

    modalOverlay.on('transitionend', function () {
        if (!body.hasClass('modal-opened')) {
            modalOverlay.hide();
        }
    });

    modal.on('transitionend', function (e) {
        e.stopPropagation();
    });
}

function elasticSearch(query, callback) {
    var baseUrl = 'https://advisorysg.ent.ap-southeast-1.aws.found.io';
    var engine = 'ghost';
    var searchOnlyKey = 'search-brya3eig6n5g9ybimkw3o9u3';

    var searchReq = new XMLHttpRequest();
    var payload = { query: query };
    searchReq.open(
        'POST',
        `${baseUrl}/api/as/v1/engines/${engine}/search.json`,
    );
    searchReq.addEventListener('load', callback);
    searchReq.setRequestHeader('Content-Type', 'application/json');
    searchReq.setRequestHeader('Authorization', `Bearer ${searchOnlyKey}`);
    searchReq.send(JSON.stringify(payload));
}

var searchSelectionId = 0;
var searchListingLength = 0;
function categoriseResult(post) {
    if (!post.url_path || !post.url_path.raw) {
        return ['home'];
    }
    var dir1 = post.url_path.raw.split('/')[1];
    if (dir1.match(/^[0-9]*$/g)) {
        var tags = ['post'];
        if (post.title.raw.startsWith('Conversations with')) {
            tags.push('conversations');
        } else if (post.title.raw.startsWith('Reflections with')) {
            tags.push('reflections');
        } else if (post.title.raw.startsWith('Insights on')) {
            tags.push('insights');
        }
        return tags;
    } else {
        var page_type = dir1.toLowerCase();
        return ['page', page_type];
    }
}

function search() {
    var searchInput = $('.search-input');
    var searchButton = $('.search-button');
    var searchResult = $('.search-result');
    var modalOverlay = $('.modal-overlay');
    var body = $('body,html');

    // for search pagination
    var searchNext = $('.search-next');
    var searchPrev = $('.search-prev');
    var pageResult = $('.page-result');
    var pageButtons = $('.buttons-hide');
    let focusOnFirst;
    var currentPage = 1;
    var postPerPage = 5;
    var maxPages;
    var prevInput = '';

    searchInput.on('input', function (e) {
        const searchValue = e.target.value;
        if (searchValue != prevInput) {
            currentPage = 1;
        }
        if (searchValue != '') {
            elasticSearch(searchValue, function () {
                var data = JSON.parse(this.responseText);
                var output = '';
                var pagination = '';
                var counter = 0;

                searchListingLength = data.results.length;
                var firstPost =
                    searchListingLength != 0
                        ? (currentPage - 1) * postPerPage
                        : -1;
                var lastPost =
                    Math.min(currentPage * postPerPage, searchListingLength) -
                    1;

                data.results.forEach((post, index) => {
                    if (counter >= firstPost && counter <= lastPost) {
                        var searchValueRegex = new RegExp(
                            `(${searchValue})`,
                            'ig',
                        );
                        var highlightedTitle =
                            post.title && post.title.raw
                                ? post.title.snippet
                                    ? post.title.snippet
                                          .replaceAll(`<em>`, `<em><mark>`)
                                          .replaceAll(`</em>`, `</mark></em>`)
                                          .trim()
                                    : post.title.raw.replaceAll(
                                          searchValueRegex,
                                          `<mark>$1</mark>`,
                                      )
                                : '';

                        var highlightedDescription =
                            post.meta_description && post.meta_description.raw
                                ? post.meta_description.snippet
                                    ? post.meta_description.snippet
                                          .replaceAll(`<em>`, `<em><mark>`)
                                          .replaceAll(`</em>`, `</mark></em>`)
                                          .trim()
                                    : post.meta_description.raw.replaceAll(
                                          searchValueRegex,
                                          `<mark>$1</mark>`,
                                      )
                                : '';
                        var tooltipDescription =
                            post.meta_description && post.meta_description.raw
                                ? post.meta_description.raw
                                : '';
                        var tagsOutput = categoriseResult(post)
                            .map(
                                (tag) => `
                          <div
                            class="text-sm inline-flex items-center font-bold leading-sm uppercase px-3 py-1 bg-brand-light text-gray-800 rounded-full my-1 capitalize mr-1"
                          >
                            ${tag}
                          </div>`,
                            )
                            .reduce((a, b) => a + b, '');

                        output += `<div class="search-result-row group">
                                <a id="search-element-${index}" 
                                class="search-result-row-link" 
                                href="${post.url_path.raw}"
                                title="${tooltipDescription}"
                                >
                                    <b>${highlightedTitle}</b>
                                    <div class="inline-flex items-center">
                                      <span class="h-6"></span>
                                      ${tagsOutput}
                                    </div>
                                    <br/>
                                    <span class="line-clamp-2 search-result-text">
                                        ${
                                            highlightedDescription
                                                ? `<p class="result-description">${highlightedDescription}</p>`
                                                : ''
                                        }
                                    </span>
                                </a>
                            </div>`;
                    }
                    counter += 1;
                });
                searchResult.html(output);
                searchResult.show();
                searchSelectionId = -1;

                clearTimeout(focusOnFirst);

                focusOnFirst = setTimeout(() => {
                    if (searchListingLength == 0 || searchSelectionId >= 0)
                        return;
                    searchSelectionId = 0;
                    $(`#search-element-${searchSelectionId}`).focus();
                }, 500);

                pagination += `<div>
                                <span class="text-lg text-gray-700">
                                Showing
                                <span class="font-medium">${
                                    firstPost + 1
                                }</span>
                                to
                                <span class="font-medium">${lastPost + 1}</span>
                                of
                                <span class="font-medium">${searchListingLength}</span>
                                results.
                                </span>
                            </div>`;
                pageResult.html(pagination);
                pageResult.show();
                pageButtons.show();

                maxPages = Math.ceil(searchListingLength / postPerPage);
                searchPrev.prop('disabled', currentPage <= 1);
                searchNext.prop('disabled', currentPage >= maxPages);
            });
        } else {
            searchResult.hide();
            pageResult.hide();
            pageButtons.hide();
        }

        if (searchValue.length > 0) {
            searchButton.addClass('search-button-clear');
        } else {
            searchButton.removeClass('search-button-clear');
        }
        prevInput = searchValue;
    });

    body.on('keydown', function () {
        if (modalOverlay.css('display') === 'none') return;
        modalOverlay.focus();
    });

    modalOverlay.on('keydown', function (e) {
        if (searchListingLength === 0) {
            searchInput.focus();
            return;
        }
        switch (e.key) {
            case 'ArrowUp':
                searchSelectionId =
                    searchSelectionId > -1 ? searchSelectionId - 1 : -1;
                if (searchSelectionId === -1) {
                    searchInput.focus();
                    break;
                }
                e.preventDefault();
                $(`#search-element-${searchSelectionId}`).focus();
                break;
            case 'ArrowDown':
                searchSelectionId =
                    searchSelectionId < searchListingLength
                        ? searchSelectionId + 1
                        : searchSelectionId;
                e.preventDefault();
                $(`#search-element-${searchSelectionId}`).focus();
                break;
            case 'ArrowLeft':
                //go back to top search bar
                searchSelectionId = -1;
                searchInput.focus();
                break;
            case 'ArrowRight':
                //go back to top search bar
                searchSelectionId = -1;
                searchInput.focus();
                break;
            case 'Enter':
                break;
            default:
                searchInput.focus();
                return;
        }
    });

    $('.search-form').on('submit', function (e) {
        e.preventDefault();
    });

    searchButton.on('click', function () {
        if ($(this).hasClass('search-button-clear')) {
            searchInput.val('').focus().keyup();
            currentPage = 1;
            searchInput.trigger('input');
        }
    });

    searchPrev.on('click', function () {
        if (currentPage > 1) {
            currentPage -= 1;
            searchInput.trigger('input');
        }
    });

    searchNext.on('click', function () {
        if (currentPage < maxPages) {
            currentPage += 1;
            searchInput.trigger('input');
        }
    });
}
*/

function burger() {
    $('.burger').on('click', function () {
        body.toggleClass('menu-opened');
    });
}

var pillColours = {};
function colourTags() {
    var getPillColour = (text) =>
        pillColours[text] ? pillColours[text] : 'bg-brand-light';
    var getPillTextColour = () => 'text-gray-800';
    $('.tag-element').each(function () {
        $(this).toggleClass('bg-brand-light');
        $(this).toggleClass(getPillColour(this.innerText));
        $(this).toggleClass('text-gray-800');
        $(this).toggleClass(getPillTextColour());
    });
}

function contentDropdown() {
    var element = document.getElementById('content-dropdown-enable');
    if (typeof element == 'undefined' || element == null) {
        return;
    }
    $('div.single-content h2').each(function () {
        var $header = $(this);
        var $container = $('<div class="dropdown-content"></div>');
        var $nextElement = $header.next();
        var $curElement = $nextElement;
        var $arrowIcon = $('<span class="arrow-icon">\u25B8</span>');
        while (
            $nextElement.length &&
            !$nextElement.is('h1') &&
            !$nextElement.is('h2')
        ) {
            $curElement = $nextElement;
            $nextElement = $nextElement.next();
            $container.append($curElement);
        }

        if ($container.length > 0) {
            // Add the dropdown-header class to the h2 element
            $header.addClass('dropdown-header');
            $header.prepend($arrowIcon);
            // Hide the entire container and insert it after h2
            $container.hide().insertAfter($header);

            // Add a click event listener to the h2 element to toggle the container
            $header.on('click', function () {
                $container.slideToggle();
                if ($arrowIcon.text() === '\u25B8') {
                    $arrowIcon.text('\u25B4');
                } else {
                    $arrowIcon.text('\u25B8');
                }
            });
        }
    });
}

function tagContentFilter() {
    const context = new URLSearchParams(window.location.search).get('context');
    const tagContent = document.querySelector('.tag-content');

    if (!tagContent) {
        return;
    }

    const posts = tagContent.querySelectorAll('.post');
    posts.forEach((post) => {
        const postTags = post.getAttribute('class').split(' ');
        if (context === 'events' && !postTags.includes('tag-hash-insights')) {
            post.style.display = 'none';
        } else if (
            context === 'interviews' &&
            !postTags.includes('tag-hash-conversations') &&
            !postTags.includes('tag-hash-reflections')
        ) {
            post.style.display = 'none';
        }
    });
}
