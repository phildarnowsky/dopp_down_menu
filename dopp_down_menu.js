/*************************************************************************/
/* The Dopp-Down menu: A simple, small, flexible autocomplete widget built on
 * jQuery.
 * 
 * Now with extra WhizBang! (TM)
 *
 * Copyright 2010 Phil Darnowsky
 * After an idea by Sarah Dopp
 *  
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 *************************************************************************/

function dopp_down_menu(
  direct_entry_field_selector, 
  autosuggest_div_selector,
  suggestion_lookup_url, 
  options) 
{
  var direct_entry_field_dirty = false;

  var staging_div;
  var staging_div_id = 'dopp_down_menu_staging_' + Math.floor(Math.random(1000000) * 1000000);
  $('body').append('<div id="' + staging_div_id + '" style="display:none"></div>');
  staging_div = $('#' + staging_div_id);

  var direct_entry_field = $(direct_entry_field_selector);
  var autosuggest_div = $(autosuggest_div_selector);

  var _options = options || {};

  var suggestion_link_class = _options.suggestion_link_class || 'dopp_down_menu_suggestions';
  var highlighted_link_class = _options.highlighted_link_class || 'dopp_down_menu_highlighted';

  var popular_choice_div_selector = _options.popular_choice_div_selector;
  var popular_choice_url = _options.popular_choice_url;
  if(popular_choice_div_selector && popular_choice_url) {
    popular_choice_div = $(popular_choice_div_selector);
  } else {
    popular_choice_div = null;
  }

  var suggestion_link_pre_insert_hook = _options.suggestion_link_pre_insert_hook || function() {};
  var suggestion_link_post_insert_hook = _options.suggestion_link_post_insert_hook || function() {};
  var pre_link_creation_hook = _options.pre_link_creation_hook || function(suggestion) {return(suggestion)};

  var minimum_lookup_string_length = _options.minimum_lookup_string_length || 3;

  var search_query_param = _options.search_query_param || 'search';

  var autosuggest_timeout = _options.autosuggest_timeout || 250;

  var name_field = _options.name_field || 'name';
  var popularity_field = _options.popularity_field || 'popularity';

  var show_popularity_in_suggestions = _options.show_popularity_in_suggestions || false;
  var show_popularity_in_popular_choices = _options.show_popularity_in_popular_choices || false;

  var dopp_down_menu_closure = function() {
    var uparrow_code = 38;
    var downarrow_code = 40;

    var last_key_down = null;

    function last(array) {
      return array.reverse()[0];
    };

    function csv_tags(string) {
      var trimmed = string.trim();
      if(trimmed.length == 0) {
        return([]);
      }

      var raw_tags = string.trim().split(/,/);
      return $.map(raw_tags, function(str) {return str.trim()});
    };

    function set_last_csv_tag(new_last_tag) {
      var current_tags = csv_tags(direct_entry_field.val());
      var new_tags;

      if(current_tags.length == 0) {
        new_tags = [new_last_tag];
      } else {
        new_tags = current_tags;
        new_tags.splice(-1, 1, new_last_tag);
      }

      var new_tag_text = new_tags.join(', ') + ', ';
      direct_entry_field.val(new_tag_text).focus();
      autosuggest_div.hide();
    };

    function create_suggestion_link(suggestion, options) {
      var _options = options || {};

      var processed_suggestion = pre_link_creation_hook(suggestion);

      var suggestion_name = processed_suggestion[name_field];
      var suggestion_popularity = processed_suggestion[popularity_field];

      var link_text = suggestion_name;
      if(_options.show_popularity) {
        link_text = link_text + ' (' + suggestion_popularity + ')';
      }

      result_html = [
        '<a href="#" class="',
        suggestion_link_class,
        '">',
        link_text,
        '</a>'
      ].join('');

      staging_div.append(result_html);
      result = staging_div.children(':last-child');
      result.click(function() {set_last_csv_tag(suggestion_name)});
      return(result);
    };

    function create_suggestion_links_from_suggestions(suggestions, options) {
      var suggestion_names;
      var suggestion_links;

      suggestion_links = $.map(suggestions, function(suggestion) {return create_suggestion_link(suggestion, options)});
      return(suggestion_links);
    };

    function clear_suggestion_highlighting() {
      $('a.' + suggestion_link_class).removeClass(highlighted_link_class);
    };

    function highlight_suggestion(suggestion_index) {
      clear_suggestion_highlighting();
      new_highlighted_suggestion = $(autosuggest_div.children('a.' + suggestion_link_class)[suggestion_index]);
      new_highlighted_suggestion.addClass(highlighted_link_class).focus();
      scroll_to_element(new_highlighted_suggestion);
    };

    function highlight_first_suggestion() {
      highlight_suggestion(0);
    };

    function highlight_last_suggestion() {
      highlight_suggestion(last_suggestion_index());
    };

    function highlighted_suggestion_index() {
      var highlighted_suggestion = $('a.' + highlighted_link_class);

      if(highlighted_suggestion) {
        return(highlighted_suggestion.prevAll('a.' + suggestion_link_class).length);
      } else {
        return(undefined);
      }
    };

    function last_suggestion_index() {
      return(autosuggest_div.children('a.' + suggestion_link_class).length - 1);
    };

    function scroll_to_element(element) {
      var element_top = element.offset().top;
      $(document).scrollTop(element_top - element.height());
    };

    function move_off_of_direct_entry_field() {
      if(last_key_down == downarrow_code) {
        highlight_first_suggestion();
      } else {
        highlight_last_suggestion();
      }
    };

    function return_to_direct_entry_field() {
      clear_suggestion_highlighting();
      direct_entry_field.focus();
      scroll_to_element(direct_entry_field);
    };

    function move_up_within_suggestion_list() {
      var currently_highlighted_index = highlighted_suggestion_index();

      if(currently_highlighted_index == 0) {
        return_to_direct_entry_field();
      } else {
        highlight_suggestion(currently_highlighted_index - 1);
      }
    };

    function move_down_within_suggestion_list() {
      var currently_highlighted_index = highlighted_suggestion_index();

      if(currently_highlighted_index == last_suggestion_index()) {
        return_to_direct_entry_field();
      } else {
        highlight_suggestion(currently_highlighted_index + 1);
      }
    };

    function move_within_suggestion_list() {
      if(last_key_down == downarrow_code) {
        move_down_within_suggestion_list();
      } else if (last_key_down == uparrow_code) {
        move_up_within_suggestion_list();
      }
    };

    function remember_last_keydown(keycode) {
      last_key_down = keycode;
    };

    function populate_div_with_suggestion_links(div_to_populate, suggestion_links) {
      div_to_populate.empty();

      $.each(
        suggestion_links, 
        function(_, suggestion_link) {
          suggestion_link_pre_insert_hook(suggestion_link, div_to_populate);
          div_to_populate.append(suggestion_link);
          suggestion_link_post_insert_hook(suggestion_link, div_to_populate);
        }
      );

      return(div_to_populate);
    };

    function populate_popular_div(data) {
      var suggestion_links = create_suggestion_links_from_suggestions(data, {show_popularity: show_popularity_in_popular_choices});
      populate_div_with_suggestion_links(popular_choice_div, suggestion_links);
    };

    function populate_suggestion_div(suggestions) {
      suggestion_links = create_suggestion_links_from_suggestions(suggestions, {show_popularity: show_popularity_in_suggestions});
      populate_div_with_suggestion_links(autosuggest_div, suggestion_links).show();
    };

    if(popular_choice_div) {
      $.get(
        popular_choice_url,
        {},
        populate_popular_div
      );
    }

    direct_entry_field.
      keypress(function(e) {
        if(e.which != 0) {
          direct_entry_field_dirty = true;
        } else {
          move_off_of_direct_entry_field();
        }
      }).
      keydown(function(e) {remember_last_keydown(e.which)});

    autosuggest_div.
      keydown(function(e) {remember_last_keydown(e.which)}).
      keypress(move_within_suggestion_list);

    setInterval(
      function() {
        if(direct_entry_field_dirty) {
          var last_entry = last(csv_tags(direct_entry_field.val()));

          if(last_entry && last_entry.length >= minimum_lookup_string_length) {
            query_params = {};
            query_params[search_query_param] = last_entry;

            $.get(
              suggestion_lookup_url,
              query_params,
              populate_suggestion_div
            );
          } else {
            autosuggest_div.hide();
          }
        }

        direct_entry_field_dirty = false;
      },
      autosuggest_timeout
    );
  };

  dopp_down_menu_closure();
}

