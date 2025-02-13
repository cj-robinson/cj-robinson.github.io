
(function(l, r) { if (!l || l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (self.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(self.document);
var app = (function () {
    'use strict';

    function noop() { }
    function assign(tar, src) {
        // @ts-ignore
        for (const k in src)
            tar[k] = src[k];
        return tar;
    }
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }
    function create_slot(definition, ctx, $$scope, fn) {
        if (definition) {
            const slot_ctx = get_slot_context(definition, ctx, $$scope, fn);
            return definition[0](slot_ctx);
        }
    }
    function get_slot_context(definition, ctx, $$scope, fn) {
        return definition[1] && fn
            ? assign($$scope.ctx.slice(), definition[1](fn(ctx)))
            : $$scope.ctx;
    }
    function get_slot_changes(definition, $$scope, dirty, fn) {
        if (definition[2] && fn) {
            const lets = definition[2](fn(dirty));
            if ($$scope.dirty === undefined) {
                return lets;
            }
            if (typeof lets === 'object') {
                const merged = [];
                const len = Math.max($$scope.dirty.length, lets.length);
                for (let i = 0; i < len; i += 1) {
                    merged[i] = $$scope.dirty[i] | lets[i];
                }
                return merged;
            }
            return $$scope.dirty | lets;
        }
        return $$scope.dirty;
    }
    function update_slot_base(slot, slot_definition, ctx, $$scope, slot_changes, get_slot_context_fn) {
        if (slot_changes) {
            const slot_context = get_slot_context(slot_definition, ctx, $$scope, get_slot_context_fn);
            slot.p(slot_context, slot_changes);
        }
    }
    function get_all_dirty_from_scope($$scope) {
        if ($$scope.ctx.length > 32) {
            const dirty = [];
            const length = $$scope.ctx.length / 32;
            for (let i = 0; i < length; i++) {
                dirty[i] = -1;
            }
            return dirty;
        }
        return -1;
    }

    const globals = (typeof window !== 'undefined'
        ? window
        : typeof globalThis !== 'undefined'
            ? globalThis
            : global);
    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        if (node.parentNode) {
            node.parentNode.removeChild(node);
        }
    }
    function destroy_each(iterations, detaching) {
        for (let i = 0; i < iterations.length; i += 1) {
            if (iterations[i])
                iterations[i].d(detaching);
        }
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function empty() {
        return text('');
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_style(node, key, value, important) {
        if (value == null) {
            node.style.removeProperty(key);
        }
        else {
            node.style.setProperty(key, value, important ? 'important' : '');
        }
    }
    function toggle_class(element, name, toggle) {
        element.classList[toggle ? 'add' : 'remove'](name);
    }
    function custom_event(type, detail, { bubbles = false, cancelable = false } = {}) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, bubbles, cancelable, detail);
        return e;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }
    function get_current_component() {
        if (!current_component)
            throw new Error('Function called outside component initialization');
        return current_component;
    }
    /**
     * The `onMount` function schedules a callback to run as soon as the component has been mounted to the DOM.
     * It must be called during the component's initialisation (but doesn't need to live *inside* the component;
     * it can be called from an external module).
     *
     * `onMount` does not run inside a [server-side component](/docs#run-time-server-side-component-api).
     *
     * https://svelte.dev/docs#run-time-svelte-onmount
     */
    function onMount(fn) {
        get_current_component().$$.on_mount.push(fn);
    }

    const dirty_components = [];
    const binding_callbacks = [];
    let render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = /* @__PURE__ */ Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    function add_flush_callback(fn) {
        flush_callbacks.push(fn);
    }
    // flush() calls callbacks in this order:
    // 1. All beforeUpdate callbacks, in order: parents before children
    // 2. All bind:this callbacks, in reverse order: children before parents.
    // 3. All afterUpdate callbacks, in order: parents before children. EXCEPT
    //    for afterUpdates called during the initial onMount, which are called in
    //    reverse order: children before parents.
    // Since callbacks might update component values, which could trigger another
    // call to flush(), the following steps guard against this:
    // 1. During beforeUpdate, any updated components will be added to the
    //    dirty_components array and will cause a reentrant call to flush(). Because
    //    the flush index is kept outside the function, the reentrant call will pick
    //    up where the earlier call left off and go through all dirty components. The
    //    current_component value is saved and restored so that the reentrant call will
    //    not interfere with the "parent" flush() call.
    // 2. bind:this callbacks cannot trigger new flush() calls.
    // 3. During afterUpdate, any updated components will NOT have their afterUpdate
    //    callback called a second time; the seen_callbacks set, outside the flush()
    //    function, guarantees this behavior.
    const seen_callbacks = new Set();
    let flushidx = 0; // Do *not* move this inside the flush() function
    function flush() {
        // Do not reenter flush while dirty components are updated, as this can
        // result in an infinite loop. Instead, let the inner flush handle it.
        // Reentrancy is ok afterwards for bindings etc.
        if (flushidx !== 0) {
            return;
        }
        const saved_component = current_component;
        do {
            // first, call beforeUpdate functions
            // and update components
            try {
                while (flushidx < dirty_components.length) {
                    const component = dirty_components[flushidx];
                    flushidx++;
                    set_current_component(component);
                    update(component.$$);
                }
            }
            catch (e) {
                // reset dirty state to not end up in a deadlocked state and then rethrow
                dirty_components.length = 0;
                flushidx = 0;
                throw e;
            }
            set_current_component(null);
            dirty_components.length = 0;
            flushidx = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        seen_callbacks.clear();
        set_current_component(saved_component);
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    /**
     * Useful for example to execute remaining `afterUpdate` callbacks before executing `destroy`.
     */
    function flush_render_callbacks(fns) {
        const filtered = [];
        const targets = [];
        render_callbacks.forEach((c) => fns.indexOf(c) === -1 ? filtered.push(c) : targets.push(c));
        targets.forEach((c) => c());
        render_callbacks = filtered;
    }
    const outroing = new Set();
    let outros;
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function transition_out(block, local, detach, callback) {
        if (block && block.o) {
            if (outroing.has(block))
                return;
            outroing.add(block);
            outros.c.push(() => {
                outroing.delete(block);
                if (callback) {
                    if (detach)
                        block.d(1);
                    callback();
                }
            });
            block.o(local);
        }
        else if (callback) {
            callback();
        }
    }

    function bind(component, name, callback) {
        const index = component.$$.props[name];
        if (index !== undefined) {
            component.$$.bound[index] = callback;
            callback(component.$$.ctx[index]);
        }
    }
    function create_component(block) {
        block && block.c();
    }
    function mount_component(component, target, anchor, customElement) {
        const { fragment, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        if (!customElement) {
            // onMount happens before the initial afterUpdate
            add_render_callback(() => {
                const new_on_destroy = component.$$.on_mount.map(run).filter(is_function);
                // if the component was destroyed immediately
                // it will update the `$$.on_destroy` reference to `null`.
                // the destructured on_destroy may still reference to the old array
                if (component.$$.on_destroy) {
                    component.$$.on_destroy.push(...new_on_destroy);
                }
                else {
                    // Edge case - component was destroyed immediately,
                    // most likely as a result of a binding initialising
                    run_all(new_on_destroy);
                }
                component.$$.on_mount = [];
            });
        }
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            flush_render_callbacks($$.after_update);
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, append_styles, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const $$ = component.$$ = {
            fragment: null,
            ctx: [],
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            on_disconnect: [],
            before_update: [],
            after_update: [],
            context: new Map(options.context || (parent_component ? parent_component.$$.context : [])),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false,
            root: options.target || parent_component.$$.root
        };
        append_styles && append_styles($$.root);
        let ready = false;
        $$.ctx = instance
            ? instance(component, options.props || {}, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor, options.customElement);
            flush();
        }
        set_current_component(parent_component);
    }
    /**
     * Base class for Svelte components. Used when dev=false.
     */
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            if (!is_function(callback)) {
                return noop;
            }
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.59.2' }, detail), { bubbles: true }));
    }
    function append_dev(target, node) {
        dispatch_dev('SvelteDOMInsert', { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev('SvelteDOMInsert', { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev('SvelteDOMRemove', { node });
        detach(node);
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev('SvelteDOMRemoveAttribute', { node, attribute });
        else
            dispatch_dev('SvelteDOMSetAttribute', { node, attribute, value });
    }
    function set_data_dev(text, data) {
        data = '' + data;
        if (text.data === data)
            return;
        dispatch_dev('SvelteDOMSetData', { node: text, data });
        text.data = data;
    }
    function validate_each_argument(arg) {
        if (typeof arg !== 'string' && !(arg && typeof arg === 'object' && 'length' in arg)) {
            let msg = '{#each} only iterates over array-like objects.';
            if (typeof Symbol === 'function' && arg && Symbol.iterator in arg) {
                msg += ' You can use a spread to convert this iterable into an array.';
            }
            throw new Error(msg);
        }
    }
    function validate_slots(name, slot, keys) {
        for (const slot_key of Object.keys(slot)) {
            if (!~keys.indexOf(slot_key)) {
                console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
            }
        }
    }
    /**
     * Base class for Svelte components with some minor dev-enhancements. Used when dev=true.
     */
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error("'target' is a required option");
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn('Component was already destroyed'); // eslint-disable-line no-console
            };
        }
        $capture_state() { }
        $inject_state() { }
    }

    /* src/collection.svelte generated by Svelte v3.59.2 */
    const file$3 = "src/collection.svelte";

    function get_each_context$2(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[16] = list[i].id;
    	child_ctx[17] = list[i].offset;
    	child_ctx[18] = list[i].horizontal;
    	child_ctx[19] = list[i].type;
    	return child_ctx;
    }

    // (149:1) {#if window.scrollY >= minInitialOffset && window.scrollY <= maxInitialOffset}
    function create_if_block_7(ctx) {
    	let div;
    	let t0;
    	let t1;
    	let t2;

    	const block = {
    		c: function create() {
    			div = element("div");
    			t0 = text("Current Hour: ");
    			t1 = text(/*currentHour*/ ctx[3]);
    			t2 = text(":00");
    			attr_dev(div, "class", "hour-counter svelte-1ov067y");
    			set_style(div, "z-index", "10");
    			set_style(div, "right", "10%");
    			add_location(div, file$3, 149, 1, 4281);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, t0);
    			append_dev(div, t1);
    			append_dev(div, t2);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*currentHour*/ 8) set_data_dev(t1, /*currentHour*/ ctx[3]);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_7.name,
    		type: "if",
    		source: "(149:1) {#if window.scrollY >= minInitialOffset && window.scrollY <= maxInitialOffset}",
    		ctx
    	});

    	return block;
    }

    // (171:36) 
    function create_if_block_6(ctx) {
    	let div;

    	const block = {
    		c: function create() {
    			div = element("div");
    			attr_dev(div, "class", "shape svelte-1ov067y");
    			set_style(div, "background-color", "grey");
    			set_style(div, "top", /*offset*/ ctx[17] + "px");
    			set_style(div, "left", /*horizontal*/ ctx[18] + "px");
    			set_style(div, "z-index", /*zIndex*/ ctx[4]);
    			add_location(div, file$3, 171, 3, 5449);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*objects*/ 1) {
    				set_style(div, "top", /*offset*/ ctx[17] + "px");
    			}

    			if (dirty & /*objects*/ 1) {
    				set_style(div, "left", /*horizontal*/ ctx[18] + "px");
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_6.name,
    		type: "if",
    		source: "(171:36) ",
    		ctx
    	});

    	return block;
    }

    // (169:27) 
    function create_if_block_5(ctx) {
    	let div;

    	const block = {
    		c: function create() {
    			div = element("div");
    			attr_dev(div, "class", "shape svelte-1ov067y");
    			set_style(div, "background-color", "black");
    			set_style(div, "top", /*offset*/ ctx[17] + "px");
    			set_style(div, "left", /*horizontal*/ ctx[18] + "px");
    			set_style(div, "z-index", /*zIndex*/ ctx[4]);
    			add_location(div, file$3, 169, 3, 5295);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*objects*/ 1) {
    				set_style(div, "top", /*offset*/ ctx[17] + "px");
    			}

    			if (dirty & /*objects*/ 1) {
    				set_style(div, "left", /*horizontal*/ ctx[18] + "px");
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_5.name,
    		type: "if",
    		source: "(169:27) ",
    		ctx
    	});

    	return block;
    }

    // (167:35) 
    function create_if_block_4(ctx) {
    	let div;

    	const block = {
    		c: function create() {
    			div = element("div");
    			attr_dev(div, "class", "shape svelte-1ov067y");
    			set_style(div, "background-color", "orange");
    			set_style(div, "top", /*offset*/ ctx[17] + "px");
    			set_style(div, "left", /*horizontal*/ ctx[18] + "px");
    			set_style(div, "z-index", /*zIndex*/ ctx[4]);
    			add_location(div, file$3, 167, 3, 5149);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*objects*/ 1) {
    				set_style(div, "top", /*offset*/ ctx[17] + "px");
    			}

    			if (dirty & /*objects*/ 1) {
    				set_style(div, "left", /*horizontal*/ ctx[18] + "px");
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_4.name,
    		type: "if",
    		source: "(167:35) ",
    		ctx
    	});

    	return block;
    }

    // (165:32) 
    function create_if_block_3(ctx) {
    	let div;

    	const block = {
    		c: function create() {
    			div = element("div");
    			attr_dev(div, "class", "shape svelte-1ov067y");
    			set_style(div, "background-color", "yellow");
    			set_style(div, "top", /*offset*/ ctx[17] + "px");
    			set_style(div, "left", /*horizontal*/ ctx[18] + "px");
    			set_style(div, "z-index", /*zIndex*/ ctx[4]);
    			add_location(div, file$3, 165, 3, 4995);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*objects*/ 1) {
    				set_style(div, "top", /*offset*/ ctx[17] + "px");
    			}

    			if (dirty & /*objects*/ 1) {
    				set_style(div, "left", /*horizontal*/ ctx[18] + "px");
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_3.name,
    		type: "if",
    		source: "(165:32) ",
    		ctx
    	});

    	return block;
    }

    // (163:32) 
    function create_if_block_2(ctx) {
    	let div;

    	const block = {
    		c: function create() {
    			div = element("div");
    			attr_dev(div, "class", "shape svelte-1ov067y");
    			set_style(div, "background-color", "purple");
    			set_style(div, "top", /*offset*/ ctx[17] + "px");
    			set_style(div, "left", /*horizontal*/ ctx[18] + "px");
    			set_style(div, "z-index", /*zIndex*/ ctx[4]);
    			add_location(div, file$3, 163, 3, 4844);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*objects*/ 1) {
    				set_style(div, "top", /*offset*/ ctx[17] + "px");
    			}

    			if (dirty & /*objects*/ 1) {
    				set_style(div, "left", /*horizontal*/ ctx[18] + "px");
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_2.name,
    		type: "if",
    		source: "(163:32) ",
    		ctx
    	});

    	return block;
    }

    // (161:35) 
    function create_if_block_1(ctx) {
    	let div;

    	const block = {
    		c: function create() {
    			div = element("div");
    			attr_dev(div, "class", "shape svelte-1ov067y");
    			set_style(div, "background-color", "green");
    			set_style(div, "top", /*offset*/ ctx[17] + "px");
    			set_style(div, "left", /*horizontal*/ ctx[18] + "px");
    			set_style(div, "z-index", /*zIndex*/ ctx[4]);
    			add_location(div, file$3, 161, 3, 4694);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*objects*/ 1) {
    				set_style(div, "top", /*offset*/ ctx[17] + "px");
    			}

    			if (dirty & /*objects*/ 1) {
    				set_style(div, "left", /*horizontal*/ ctx[18] + "px");
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1.name,
    		type: "if",
    		source: "(161:35) ",
    		ctx
    	});

    	return block;
    }

    // (159:2) {#if type === 'waterbottle'}
    function create_if_block(ctx) {
    	let div;

    	const block = {
    		c: function create() {
    			div = element("div");
    			attr_dev(div, "class", "shape svelte-1ov067y");
    			set_style(div, "background-color", "blue");
    			set_style(div, "top", /*offset*/ ctx[17] + "px");
    			set_style(div, "left", /*horizontal*/ ctx[18] + "px");
    			set_style(div, "z-index", /*zIndex*/ ctx[4]);
    			add_location(div, file$3, 159, 3, 4543);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*objects*/ 1) {
    				set_style(div, "top", /*offset*/ ctx[17] + "px");
    			}

    			if (dirty & /*objects*/ 1) {
    				set_style(div, "left", /*horizontal*/ ctx[18] + "px");
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block.name,
    		type: "if",
    		source: "(159:2) {#if type === 'waterbottle'}",
    		ctx
    	});

    	return block;
    }

    // (158:2) {#each objects as { id, offset, horizontal, type}}
    function create_each_block$2(ctx) {
    	let if_block_anchor;

    	function select_block_type(ctx, dirty) {
    		if (/*type*/ ctx[19] === 'waterbottle') return create_if_block;
    		if (/*type*/ ctx[19] === 'plasticbags') return create_if_block_1;
    		if (/*type*/ ctx[19] === 'plastics') return create_if_block_2;
    		if (/*type*/ ctx[19] === 'wrappers') return create_if_block_3;
    		if (/*type*/ ctx[19] === 'sportsballs') return create_if_block_4;
    		if (/*type*/ ctx[19] === 'cig') return create_if_block_5;
    		if (/*type*/ ctx[19] === 'glassbottles') return create_if_block_6;
    	}

    	let current_block_type = select_block_type(ctx);
    	let if_block = current_block_type && current_block_type(ctx);

    	const block = {
    		c: function create() {
    			if (if_block) if_block.c();
    			if_block_anchor = empty();
    		},
    		m: function mount(target, anchor) {
    			if (if_block) if_block.m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (current_block_type === (current_block_type = select_block_type(ctx)) && if_block) {
    				if_block.p(ctx, dirty);
    			} else {
    				if (if_block) if_block.d(1);
    				if_block = current_block_type && current_block_type(ctx);

    				if (if_block) {
    					if_block.c();
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			}
    		},
    		d: function destroy(detaching) {
    			if (if_block) {
    				if_block.d(detaching);
    			}

    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block$2.name,
    		type: "each",
    		source: "(158:2) {#each objects as { id, offset, horizontal, type}}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$3(ctx) {
    	let div2;
    	let t0;
    	let div0;
    	let t1;
    	let div1;
    	let if_block = window.scrollY >= /*minInitialOffset*/ ctx[1] && window.scrollY <= /*maxInitialOffset*/ ctx[2] && create_if_block_7(ctx);
    	let each_value = /*objects*/ ctx[0];
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block$2(get_each_context$2(ctx, each_value, i));
    	}

    	const block = {
    		c: function create() {
    			div2 = element("div");
    			if (if_block) if_block.c();
    			t0 = space();
    			div0 = element("div");
    			t1 = space();
    			div1 = element("div");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			attr_dev(div0, "class", "center-square svelte-1ov067y");
    			add_location(div0, file$3, 154, 1, 4391);
    			attr_dev(div1, "class", "trash-wrapper svelte-1ov067y");
    			add_location(div1, file$3, 156, 1, 4427);
    			set_style(div2, "height", /*maxInitialOffset*/ ctx[2] + "px");
    			add_location(div2, file$3, 147, 0, 4157);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div2, anchor);
    			if (if_block) if_block.m(div2, null);
    			append_dev(div2, t0);
    			append_dev(div2, div0);
    			append_dev(div2, t1);
    			append_dev(div2, div1);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				if (each_blocks[i]) {
    					each_blocks[i].m(div1, null);
    				}
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (window.scrollY >= /*minInitialOffset*/ ctx[1] && window.scrollY <= /*maxInitialOffset*/ ctx[2]) {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    				} else {
    					if_block = create_if_block_7(ctx);
    					if_block.c();
    					if_block.m(div2, t0);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}

    			if (dirty & /*objects, zIndex*/ 17) {
    				each_value = /*objects*/ ctx[0];
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context$2(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block$2(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(div1, null);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}

    			if (dirty & /*maxInitialOffset*/ 4) {
    				set_style(div2, "height", /*maxInitialOffset*/ ctx[2] + "px");
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div2);
    			if (if_block) if_block.d();
    			destroy_each(each_blocks, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$3.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$3($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Collection', slots, []);
    	let { steps = [] } = $$props;
    	let objects = [];
    	let windowHeight = 0;
    	let windowWidth = 0;
    	let initialScrollY = 0;
    	let minInitialOffset = Number.MAX_VALUE;
    	let maxInitialOffset = Number.MIN_VALUE;
    	let currentHour = 0;
    	let squareBounds = { top: 0, bottom: 0 };
    	let zIndex = 0;

    	const objectConfigs = [
    		{
    			type: 'waterbottle',
    			number: 1981,
    			imageSrc: 'water_bottle.svg',
    			step: 4
    		},
    		{
    			type: 'cig',
    			number: 18656,
    			imageSrc: 'water_bottle.svg',
    			step: 5
    		},
    		{
    			type: 'sportsballs',
    			number: 13,
    			imageSrc: 'water_bottle.svg',
    			step: 6
    		},
    		{
    			type: 'glassbottles',
    			number: 21,
    			imageSrc: 'water_bottle.svg',
    			step: 6
    		},
    		{
    			type: 'plasticbags',
    			number: 867,
    			imageSrc: 'water_bottle.svg',
    			step: 6
    		},
    		{
    			type: 'wrappers',
    			number: 1427,
    			imageSrc: 'water_bottle.svg',
    			step: 6
    		},
    		{
    			type: 'plastics',
    			number: 1462,
    			imageSrc: 'water_bottle.svg',
    			step: 6
    		}
    	];

    	let columns = 100; // This can be adjusted based on the screen width or desired grid density
    	let cellWidth = 10;
    	let cellHeight = 10;

    	onMount(() => {
    		windowHeight = window.innerHeight;
    		windowWidth = window.innerWidth;
    		initialScrollY = window.scrollY;
    		initObjects();

    		function throttle(fn, wait) {
    			let last = 0;

    			return (...args) => {
    				const now = new Date();

    				if (now - last > wait) {
    					last = now;
    					fn(...args);
    				}
    			};
    		}

    		window.addEventListener('scroll', throttle(handleScroll, 100));

    		return () => {
    			window.removeEventListener('scroll', handleScroll);
    		};
    	});

    	function initObjects() {
    		const stepHeight = windowHeight * 3;
    		$$invalidate(1, minInitialOffset = windowHeight * 22);
    		$$invalidate(2, maxInitialOffset = windowHeight * 40);

    		$$invalidate(0, objects = objectConfigs.flatMap(config => {
    			return Array.from({ length: config.number }, (_, i) => {
    				let stepIndex = steps.findIndex((_, index) => index === config.step);
    				let earlyAppearanceOffset = 0;
    				let originalHorizontal = windowWidth / 2 - 55 + Math.random() * 85;

    				if (i < 1) {
    					// Assuming you want the first two objects of each type to appear earlier
    					earlyAppearanceOffset = stepHeight * stepIndex + stepHeight * 0.1; // Smaller offset for earlier appearance

    					if (config.type === 'sportsballs') {
    						originalHorizontal = windowWidth / 2 - 55;
    					} else if (config.type === 'glassbottles') {
    						originalHorizontal = windowWidth / 2 - 55 + .25 * 85;
    					} else if (config.type === 'plastics') {
    						originalHorizontal = windowWidth / 2 - 55 + .5 * 85;
    					} else if (config.type === 'wrappers') {
    						originalHorizontal = windowWidth / 2 - 55 + .75 * 85;
    					} else if (config.type === 'plasticbags') {
    						originalHorizontal = windowWidth / 2 - 55 + 85;
    					}
    				} else {
    					earlyAppearanceOffset = minInitialOffset + Math.random() * (maxInitialOffset - minInitialOffset);
    				}

    				return {
    					id: `${config.type}-${i}`,
    					type: config.type,
    					imageSrc: config.imageSrc,
    					initialOffset: earlyAppearanceOffset,
    					horizontal: originalHorizontal,
    					originalHorizontal
    				};
    			});
    		}));
    	}

    	function handleScroll() {
    		const scrollY = window.scrollY;
    		$$invalidate(3, currentHour = Math.floor((scrollY - minInitialOffset) / (maxInitialOffset - minInitialOffset) * 23) % 23 + 1);

    		// Normal scroll behavior
    		$$invalidate(0, objects = objects.map(obj => {
    			let newOffset = obj.initialOffset - scrollY;

    			return {
    				...obj,
    				horizontal: obj.originalHorizontal,
    				offset: newOffset <= squareBounds.top
    				? squareBounds.top
    				: newOffset
    			};
    		}));
    	}

    	const writable_props = ['steps'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Collection> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('steps' in $$props) $$invalidate(5, steps = $$props.steps);
    	};

    	$$self.$capture_state = () => ({
    		onMount,
    		steps,
    		objects,
    		windowHeight,
    		windowWidth,
    		initialScrollY,
    		minInitialOffset,
    		maxInitialOffset,
    		currentHour,
    		squareBounds,
    		zIndex,
    		objectConfigs,
    		columns,
    		cellWidth,
    		cellHeight,
    		initObjects,
    		handleScroll
    	});

    	$$self.$inject_state = $$props => {
    		if ('steps' in $$props) $$invalidate(5, steps = $$props.steps);
    		if ('objects' in $$props) $$invalidate(0, objects = $$props.objects);
    		if ('windowHeight' in $$props) windowHeight = $$props.windowHeight;
    		if ('windowWidth' in $$props) windowWidth = $$props.windowWidth;
    		if ('initialScrollY' in $$props) initialScrollY = $$props.initialScrollY;
    		if ('minInitialOffset' in $$props) $$invalidate(1, minInitialOffset = $$props.minInitialOffset);
    		if ('maxInitialOffset' in $$props) $$invalidate(2, maxInitialOffset = $$props.maxInitialOffset);
    		if ('currentHour' in $$props) $$invalidate(3, currentHour = $$props.currentHour);
    		if ('squareBounds' in $$props) squareBounds = $$props.squareBounds;
    		if ('zIndex' in $$props) $$invalidate(4, zIndex = $$props.zIndex);
    		if ('columns' in $$props) columns = $$props.columns;
    		if ('cellWidth' in $$props) cellWidth = $$props.cellWidth;
    		if ('cellHeight' in $$props) cellHeight = $$props.cellHeight;
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [objects, minInitialOffset, maxInitialOffset, currentHour, zIndex, steps];
    }

    class Collection extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$3, create_fragment$3, safe_not_equal, { steps: 5 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Collection",
    			options,
    			id: create_fragment$3.name
    		});
    	}

    	get steps() {
    		throw new Error("<Collection>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set steps(value) {
    		throw new Error("<Collection>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/Scrolly.svelte generated by Svelte v3.59.2 */
    const file$2 = "src/Scrolly.svelte";

    function create_fragment$2(ctx) {
    	let div;
    	let current;
    	const default_slot_template = /*#slots*/ ctx[7].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[6], null);

    	const block = {
    		c: function create() {
    			div = element("div");
    			if (default_slot) default_slot.c();
    			add_location(div, file$2, 81, 2, 2147);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);

    			if (default_slot) {
    				default_slot.m(div, null);
    			}

    			/*div_binding*/ ctx[8](div);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if (default_slot) {
    				if (default_slot.p && (!current || dirty & /*$$scope*/ 64)) {
    					update_slot_base(
    						default_slot,
    						default_slot_template,
    						ctx,
    						/*$$scope*/ ctx[6],
    						!current
    						? get_all_dirty_from_scope(/*$$scope*/ ctx[6])
    						: get_slot_changes(default_slot_template, /*$$scope*/ ctx[6], dirty, null),
    						null
    					);
    				}
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(default_slot, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(default_slot, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			if (default_slot) default_slot.d(detaching);
    			/*div_binding*/ ctx[8](null);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$2.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$2($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Scrolly', slots, ['default']);
    	let { root = null } = $$props;
    	let { top = 0 } = $$props;
    	let { bottom = 0 } = $$props;
    	let { increments = 100 } = $$props;
    	let { value = undefined } = $$props;
    	const steps = [];
    	const threshold = [];
    	let nodes = [];
    	let intersectionObservers = [];
    	let container;

    	const update = () => {
    		if (!nodes.length) return;
    		nodes.forEach(createObserver);
    	};

    	const mostInView = () => {
    		let maxRatio = 0;
    		let maxIndex = 0;

    		for (let i = 0; i < steps.length; i++) {
    			if (steps[i] > maxRatio) {
    				maxRatio = steps[i];
    				maxIndex = i;
    			}
    		}

    		if (maxRatio > 0) $$invalidate(1, value = maxIndex); else $$invalidate(1, value = undefined);
    	};

    	const createObserver = (node, index) => {
    		const handleIntersect = e => {
    			e[0].isIntersecting;
    			const ratio = e[0].intersectionRatio;
    			steps[index] = ratio;
    			mostInView();
    		};

    		const marginTop = top ? top * -1 : 0;
    		const marginBottom = bottom ? bottom * -1 : 0;
    		const rootMargin = `${marginTop}px 0px ${marginBottom}px 0px`;
    		const options = { root, rootMargin, threshold };
    		if (intersectionObservers[index]) intersectionObservers[index].disconnect();
    		const io = new IntersectionObserver(handleIntersect, options);
    		io.observe(node);
    		intersectionObservers[index] = io;
    	};

    	onMount(() => {
    		for (let i = 0; i < increments + 1; i++) {
    			threshold.push(i / increments);
    		}

    		nodes = container.querySelectorAll(":scope > *");
    		update();
    	});

    	const writable_props = ['root', 'top', 'bottom', 'increments', 'value'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Scrolly> was created with unknown prop '${key}'`);
    	});

    	function div_binding($$value) {
    		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
    			container = $$value;
    			$$invalidate(0, container);
    		});
    	}

    	$$self.$$set = $$props => {
    		if ('root' in $$props) $$invalidate(2, root = $$props.root);
    		if ('top' in $$props) $$invalidate(3, top = $$props.top);
    		if ('bottom' in $$props) $$invalidate(4, bottom = $$props.bottom);
    		if ('increments' in $$props) $$invalidate(5, increments = $$props.increments);
    		if ('value' in $$props) $$invalidate(1, value = $$props.value);
    		if ('$$scope' in $$props) $$invalidate(6, $$scope = $$props.$$scope);
    	};

    	$$self.$capture_state = () => ({
    		onMount,
    		root,
    		top,
    		bottom,
    		increments,
    		value,
    		steps,
    		threshold,
    		nodes,
    		intersectionObservers,
    		container,
    		update,
    		mostInView,
    		createObserver
    	});

    	$$self.$inject_state = $$props => {
    		if ('root' in $$props) $$invalidate(2, root = $$props.root);
    		if ('top' in $$props) $$invalidate(3, top = $$props.top);
    		if ('bottom' in $$props) $$invalidate(4, bottom = $$props.bottom);
    		if ('increments' in $$props) $$invalidate(5, increments = $$props.increments);
    		if ('value' in $$props) $$invalidate(1, value = $$props.value);
    		if ('nodes' in $$props) nodes = $$props.nodes;
    		if ('intersectionObservers' in $$props) intersectionObservers = $$props.intersectionObservers;
    		if ('container' in $$props) $$invalidate(0, container = $$props.container);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*top, bottom*/ 24) {
    			(update());
    		}
    	};

    	return [container, value, root, top, bottom, increments, $$scope, slots, div_binding];
    }

    class Scrolly extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init(this, options, instance$2, create_fragment$2, safe_not_equal, {
    			root: 2,
    			top: 3,
    			bottom: 4,
    			increments: 5,
    			value: 1
    		});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Scrolly",
    			options,
    			id: create_fragment$2.name
    		});
    	}

    	get root() {
    		throw new Error("<Scrolly>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set root(value) {
    		throw new Error("<Scrolly>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get top() {
    		throw new Error("<Scrolly>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set top(value) {
    		throw new Error("<Scrolly>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get bottom() {
    		throw new Error("<Scrolly>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set bottom(value) {
    		throw new Error("<Scrolly>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get increments() {
    		throw new Error("<Scrolly>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set increments(value) {
    		throw new Error("<Scrolly>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get value() {
    		throw new Error("<Scrolly>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set value(value) {
    		throw new Error("<Scrolly>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/analysis.svelte generated by Svelte v3.59.2 */

    const { console: console_1 } = globals;
    const file$1 = "src/analysis.svelte";

    function get_each_context$1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[11] = list[i];
    	return child_ctx;
    }

    function get_each_context_1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[14] = list[i];
    	return child_ctx;
    }

    // (87:12) {#each Array.from({ length: config.number }) as _}
    function create_each_block_1(ctx) {
    	let div;

    	const block = {
    		c: function create() {
    			div = element("div");
    			attr_dev(div, "class", "shape svelte-1l5s51h");
    			set_style(div, "background-color", /*config*/ ctx[11].color);
    			add_location(div, file$1, 87, 16, 2460);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block_1.name,
    		type: "each",
    		source: "(87:12) {#each Array.from({ length: config.number }) as _}",
    		ctx
    	});

    	return block;
    }

    // (84:4) {#each objectConfigs as config}
    function create_each_block$1(ctx) {
    	let div0;
    	let h3;
    	let t0_value = /*config*/ ctx[11].number.toLocaleString() + "";
    	let t0;
    	let t1;
    	let t2_value = /*config*/ ctx[11].type + "";
    	let t2;
    	let t3;
    	let div1;
    	let t4;
    	let each_value_1 = Array.from({ length: /*config*/ ctx[11].number });
    	validate_each_argument(each_value_1);
    	let each_blocks = [];

    	for (let i = 0; i < each_value_1.length; i += 1) {
    		each_blocks[i] = create_each_block_1(get_each_context_1(ctx, each_value_1, i));
    	}

    	const block = {
    		c: function create() {
    			div0 = element("div");
    			h3 = element("h3");
    			t0 = text(t0_value);
    			t1 = space();
    			t2 = text(t2_value);
    			t3 = space();
    			div1 = element("div");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t4 = space();
    			add_location(h3, file$1, 84, 13, 2281);
    			add_location(div0, file$1, 84, 8, 2276);
    			attr_dev(div1, "class", "chart-container svelte-1l5s51h");
    			add_location(div1, file$1, 85, 8, 2351);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div0, anchor);
    			append_dev(div0, h3);
    			append_dev(h3, t0);
    			append_dev(h3, t1);
    			append_dev(h3, t2);
    			insert_dev(target, t3, anchor);
    			insert_dev(target, div1, anchor);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				if (each_blocks[i]) {
    					each_blocks[i].m(div1, null);
    				}
    			}

    			append_dev(div1, t4);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*objectConfigs*/ 1) {
    				each_value_1 = Array.from({ length: /*config*/ ctx[11].number });
    				validate_each_argument(each_value_1);
    				let i;

    				for (i = 0; i < each_value_1.length; i += 1) {
    					const child_ctx = get_each_context_1(ctx, each_value_1, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block_1(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(div1, t4);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value_1.length;
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div0);
    			if (detaching) detach_dev(t3);
    			if (detaching) detach_dev(div1);
    			destroy_each(each_blocks, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block$1.name,
    		type: "each",
    		source: "(84:4) {#each objectConfigs as config}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$1(ctx) {
    	let div0;
    	let h1;
    	let t1;
    	let div1;
    	let t3;
    	let div2;
    	let each_value = /*objectConfigs*/ ctx[0];
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block$1(get_each_context$1(ctx, each_value, i));
    	}

    	const block = {
    		c: function create() {
    			div0 = element("div");
    			h1 = element("h1");
    			h1.textContent = "Total Garbage Count";
    			t1 = space();
    			div1 = element("div");
    			div1.textContent = "That's over 6,400 lb of trash. All in a day's work.";
    			t3 = space();
    			div2 = element("div");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			add_location(h1, file$1, 79, 31, 2077);
    			set_style(div0, "text-align", "center");
    			add_location(div0, file$1, 79, 0, 2046);
    			set_style(div1, "text-align", "center");
    			add_location(div1, file$1, 80, 0, 2112);
    			attr_dev(div2, "class", "chart-container svelte-1l5s51h");
    			add_location(div2, file$1, 82, 0, 2202);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div0, anchor);
    			append_dev(div0, h1);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, div1, anchor);
    			insert_dev(target, t3, anchor);
    			insert_dev(target, div2, anchor);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				if (each_blocks[i]) {
    					each_blocks[i].m(div2, null);
    				}
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*Array, objectConfigs*/ 1) {
    				each_value = /*objectConfigs*/ ctx[0];
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context$1(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block$1(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(div2, null);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div0);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(div1);
    			if (detaching) detach_dev(t3);
    			if (detaching) detach_dev(div2);
    			destroy_each(each_blocks, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$1.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$1($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Analysis', slots, []);
    	let objects = [];
    	let windowHeight = 0;
    	let width;
    	let height;
    	const margin = { top: 10, bottom: 10, left: 10, right: 10 };

    	const objectConfigs = [
    		{
    			type: 'Waterbottles',
    			number: 1981,
    			color: 'blue'
    		},
    		{
    			type: 'Cigarette Butts',
    			number: 18656,
    			color: 'black'
    		},
    		{
    			type: 'Plastic Bags',
    			number: 867,
    			color: 'green'
    		},
    		{
    			type: 'Polystyrene Items',
    			number: 1462,
    			color: 'purple'
    		},
    		{
    			type: 'Glass Bottles',
    			number: 21,
    			color: 'grey'
    		},
    		{
    			type: 'Wrappers',
    			number: 1427,
    			color: 'yellow'
    		},
    		{
    			type: 'Sports Balls',
    			number: 13,
    			color: 'orange'
    		}
    	];

    	let columns = 200;
    	let cellWidth = 10;
    	let cellHeight = 10;

    	onMount(() => {
    		initObjects();
    	});

    	function initObjects() {
    		objects = objectConfigs.flatMap(config => {
    			return Array.from({ length: config.number }, (_, i) => {
    				return { type: config.type, color: config.color };
    			});
    		});

    		calculateGridPositions();
    		console.log(objects);
    	}

    	function calculateGridPositions() {
    		let yStart = windowHeight + 50; // Starting below the viewport height
    		let xStart = 10;

    		objectConfigs.forEach(config => {
    			let index = 0;

    			objects.filter(obj => obj.type === config.type).forEach(obj => {
    				let row = Math.floor(index / columns);
    				let col = index % columns;
    				obj.finalX = xStart + col * cellWidth;
    				obj.finalY = yStart + row * cellHeight;
    				index++;
    			});

    			yStart += (Math.ceil(config.number / columns) + 1) * cellHeight; // Move to next block
    		});
    	}

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console_1.warn(`<Analysis> was created with unknown prop '${key}'`);
    	});

    	$$self.$capture_state = () => ({
    		onMount,
    		objects,
    		windowHeight,
    		width,
    		height,
    		margin,
    		objectConfigs,
    		columns,
    		cellWidth,
    		cellHeight,
    		initObjects,
    		calculateGridPositions
    	});

    	$$self.$inject_state = $$props => {
    		if ('objects' in $$props) objects = $$props.objects;
    		if ('windowHeight' in $$props) windowHeight = $$props.windowHeight;
    		if ('width' in $$props) width = $$props.width;
    		if ('height' in $$props) height = $$props.height;
    		if ('columns' in $$props) columns = $$props.columns;
    		if ('cellWidth' in $$props) cellWidth = $$props.cellWidth;
    		if ('cellHeight' in $$props) cellHeight = $$props.cellHeight;
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [objectConfigs];
    }

    class Analysis extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$1, create_fragment$1, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Analysis",
    			options,
    			id: create_fragment$1.name
    		});
    	}
    }

    /* src/App.svelte generated by Svelte v3.59.2 */
    const file = "src/App.svelte";

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[5] = list[i];
    	child_ctx[7] = i;
    	return child_ctx;
    }

    // (78:4) {#each steps as text, i}
    function create_each_block(ctx) {
    	let div1;
    	let div0;
    	let raw_value = /*text*/ ctx[5] + "";

    	const block = {
    		c: function create() {
    			div1 = element("div");
    			div0 = element("div");
    			attr_dev(div0, "class", "step-content svelte-6wp0ur");
    			add_location(div0, file, 79, 6, 3764);
    			attr_dev(div1, "class", "step svelte-6wp0ur");
    			toggle_class(div1, "active", /*value*/ ctx[0] === /*i*/ ctx[7]);
    			add_location(div1, file, 78, 5, 3712);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div1, anchor);
    			append_dev(div1, div0);
    			div0.innerHTML = raw_value;
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*value*/ 1) {
    				toggle_class(div1, "active", /*value*/ ctx[0] === /*i*/ ctx[7]);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div1);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block.name,
    		type: "each",
    		source: "(78:4) {#each steps as text, i}",
    		ctx
    	});

    	return block;
    }

    // (77:3) <Scrolly bind:value>
    function create_default_slot(ctx) {
    	let t;
    	let div;
    	let each_value = /*steps*/ ctx[1];
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
    	}

    	const block = {
    		c: function create() {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t = space();
    			div = element("div");
    			attr_dev(div, "class", "spacer svelte-6wp0ur");
    			add_location(div, file, 82, 4, 3837);
    		},
    		m: function mount(target, anchor) {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				if (each_blocks[i]) {
    					each_blocks[i].m(target, anchor);
    				}
    			}

    			insert_dev(target, t, anchor);
    			insert_dev(target, div, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*value, steps*/ 3) {
    				each_value = /*steps*/ ctx[1];
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(t.parentNode, t);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}
    		},
    		d: function destroy(detaching) {
    			destroy_each(each_blocks, detaching);
    			if (detaching) detach_dev(t);
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot.name,
    		type: "slot",
    		source: "(77:3) <Scrolly bind:value>",
    		ctx
    	});

    	return block;
    }

    function create_fragment(ctx) {
    	let section0;
    	let div0;
    	let a0;
    	let h10;
    	let t1;
    	let article;
    	let section1;
    	let h11;
    	let t3;
    	let br;
    	let t4;
    	let h20;
    	let t6;
    	let h21;
    	let t8;
    	let p0;
    	let t9;
    	let a1;
    	let t11;
    	let a2;
    	let t13;
    	let t14;
    	let p1;
    	let t16;
    	let div1;
    	let t17;
    	let div4;
    	let div2;
    	let scrolly;
    	let updating_value;
    	let t18;
    	let div3;
    	let visualization;
    	let t19;
    	let div5;
    	let analysis;
    	let t20;
    	let div6;
    	let t21;
    	let section2;
    	let h22;
    	let t23;
    	let p2;
    	let t24;
    	let a3;
    	let t26;
    	let t27;
    	let p3;
    	let t29;
    	let div7;
    	let t30;
    	let p4;
    	let current;

    	function scrolly_value_binding(value) {
    		/*scrolly_value_binding*/ ctx[2](value);
    	}

    	let scrolly_props = {
    		$$slots: { default: [create_default_slot] },
    		$$scope: { ctx }
    	};

    	if (/*value*/ ctx[0] !== void 0) {
    		scrolly_props.value = /*value*/ ctx[0];
    	}

    	scrolly = new Scrolly({ props: scrolly_props, $$inline: true });
    	binding_callbacks.push(() => bind(scrolly, 'value', scrolly_value_binding));

    	visualization = new Collection({
    			props: { steps: /*steps*/ ctx[1] },
    			$$inline: true
    		});

    	analysis = new Analysis({ $$inline: true });

    	const block = {
    		c: function create() {
    			section0 = element("section");
    			div0 = element("div");
    			a0 = element("a");
    			h10 = element("h1");
    			h10.textContent = "C.J. Robinson";
    			t1 = space();
    			article = element("article");
    			section1 = element("section");
    			h11 = element("h1");
    			h11.textContent = "Mr. Trash Wheel®";
    			t3 = space();
    			br = element("br");
    			t4 = space();
    			h20 = element("h2");
    			h20.textContent = "Society makes a lot of trash. We're not quite sure what to do with\n\t\t\tit.";
    			t6 = space();
    			h21 = element("h2");
    			h21.textContent = "Anthropomorphizing might help.";
    			t8 = space();
    			p0 = element("p");
    			t9 = text("Powered by data from ");
    			a1 = element("a");
    			a1.textContent = "www.mrtrashwheel.com";
    			t11 = text(", and thanks to\n\t\t\t");
    			a2 = element("a");
    			a2.textContent = "#tidytuesday";
    			t13 = text(" for the idea.");
    			t14 = space();
    			p1 = element("p");
    			p1.textContent = "Works best on desktop. Keep scrolling!";
    			t16 = space();
    			div1 = element("div");
    			t17 = space();
    			div4 = element("div");
    			div2 = element("div");
    			create_component(scrolly.$$.fragment);
    			t18 = space();
    			div3 = element("div");
    			create_component(visualization.$$.fragment);
    			t19 = space();
    			div5 = element("div");
    			create_component(analysis.$$.fragment);
    			t20 = space();
    			div6 = element("div");
    			t21 = space();
    			section2 = element("section");
    			h22 = element("h2");
    			h22.textContent = "Mr. Trash Wheel Chugs On";
    			t23 = space();
    			p2 = element("p");
    			t24 = text("In a time of rapid warming and high levels of carbon, ");
    			a3 = element("a");
    			a3.textContent = "engineering our way out of a climate catastrophe";
    			t26 = text(" can feel fraught. Even Mr. Trash Wheel, due to the complexities involved,\n\t\t\tmust burn the contents of his dumpsters each day rather than recycle\n\t\t\tthe plastics found (the incineration is used to create electricity).");
    			t27 = space();
    			p3 = element("p");
    			p3.textContent = "In spite of that, it's galvanizing to see projects that can make an\n\t\t\timmediate impact on communities and begin to mitigate some of the\n\t\t\tdamage today. While the fight continues for limiting single-use\n\t\t\tplastics, more googly-eyed plastic interceptors can help alleviate\n\t\t\tthe waste throghout our econosytem in the meantime.";
    			t29 = space();
    			div7 = element("div");
    			t30 = space();
    			p4 = element("p");
    			p4.textContent = "Built in Svelte. Thanks to Michell Estberg for his contributions.";
    			attr_dev(h10, "class", "title");
    			set_style(h10, "font-family", "-apple-system, BlinkMacSystemFont, 'helvetica neue', helvetica,arial, sans-serif");
    			set_style(h10, "color", "white");
    			set_style(h10, "font-size", "2rem");
    			set_style(h10, "margin", "0");
    			set_style(h10, "width", "100%");
    			set_style(h10, "background-color", "#a2a251");
    			set_style(h10, "padding", "1.5rem");
    			set_style(h10, "overflow-x", "hidden");
    			add_location(h10, file, 43, 3, 2642);
    			attr_dev(a0, "href", "https://cj-robinson.github.io");
    			set_style(a0, "color", "transparent");
    			add_location(a0, file, 42, 2, 2571);
    			attr_dev(div0, "class", "hero-body");
    			set_style(div0, "padding", "0px");
    			add_location(div0, file, 41, 1, 2524);
    			attr_dev(section0, "class", "hero");
    			set_style(section0, "padding", "0px");
    			add_location(section0, file, 40, 0, 2479);
    			set_style(h11, "font-size", "50px");
    			add_location(h11, file, 54, 2, 3011);
    			add_location(br, file, 55, 2, 3062);
    			add_location(h20, file, 56, 2, 3071);
    			add_location(h21, file, 60, 2, 3163);
    			attr_dev(a1, "href", "https://www.mrtrashwheel.com/");
    			add_location(a1, file, 62, 24, 3233);
    			attr_dev(a2, "href", "https://github.com/rfordatascience/tidytuesday/tree/master");
    			add_location(a2, file, 65, 3, 3325);
    			add_location(p0, file, 61, 2, 3205);
    			add_location(p1, file, 69, 2, 3443);
    			attr_dev(section1, "class", "article-section svelte-6wp0ur");
    			add_location(section1, file, 53, 1, 2975);
    			attr_dev(div1, "class", "spacer svelte-6wp0ur");
    			add_location(div1, file, 73, 1, 3562);
    			attr_dev(div2, "class", "steps-container svelte-6wp0ur");
    			add_location(div2, file, 75, 2, 3624);
    			attr_dev(div3, "class", "sticky svelte-6wp0ur");
    			add_location(div3, file, 85, 2, 3885);
    			attr_dev(div4, "class", "section-container svelte-6wp0ur");
    			add_location(div4, file, 74, 1, 3590);
    			set_style(div5, "position", "sticky");
    			add_location(div5, file, 89, 1, 3953);
    			attr_dev(div6, "class", "half-spacer svelte-6wp0ur");
    			add_location(div6, file, 93, 1, 4009);
    			add_location(h22, file, 95, 2, 4074);
    			attr_dev(a3, "href", "https://www.nytimes.com/2024/03/31/climate/climate-change-carbon-capture-ccs.html");
    			add_location(a3, file, 97, 57, 4195);
    			set_style(p2, "text-align", "left");
    			add_location(p2, file, 96, 2, 4110);
    			set_style(p3, "text-align", "left");
    			add_location(p3, file, 104, 2, 4580);
    			attr_dev(section2, "class", "article-section svelte-6wp0ur");
    			add_location(section2, file, 94, 1, 4038);
    			attr_dev(div7, "class", "half-spacer svelte-6wp0ur");
    			add_location(div7, file, 113, 1, 4961);
    			set_style(p4, "font-size", "14px");
    			add_location(p4, file, 115, 1, 4991);
    			attr_dev(article, "class", "article svelte-6wp0ur");
    			add_location(article, file, 52, 0, 2948);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, section0, anchor);
    			append_dev(section0, div0);
    			append_dev(div0, a0);
    			append_dev(a0, h10);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, article, anchor);
    			append_dev(article, section1);
    			append_dev(section1, h11);
    			append_dev(section1, t3);
    			append_dev(section1, br);
    			append_dev(section1, t4);
    			append_dev(section1, h20);
    			append_dev(section1, t6);
    			append_dev(section1, h21);
    			append_dev(section1, t8);
    			append_dev(section1, p0);
    			append_dev(p0, t9);
    			append_dev(p0, a1);
    			append_dev(p0, t11);
    			append_dev(p0, a2);
    			append_dev(p0, t13);
    			append_dev(section1, t14);
    			append_dev(section1, p1);
    			append_dev(article, t16);
    			append_dev(article, div1);
    			append_dev(article, t17);
    			append_dev(article, div4);
    			append_dev(div4, div2);
    			mount_component(scrolly, div2, null);
    			append_dev(div4, t18);
    			append_dev(div4, div3);
    			mount_component(visualization, div3, null);
    			append_dev(article, t19);
    			append_dev(article, div5);
    			mount_component(analysis, div5, null);
    			append_dev(article, t20);
    			append_dev(article, div6);
    			append_dev(article, t21);
    			append_dev(article, section2);
    			append_dev(section2, h22);
    			append_dev(section2, t23);
    			append_dev(section2, p2);
    			append_dev(p2, t24);
    			append_dev(p2, a3);
    			append_dev(p2, t26);
    			append_dev(section2, t27);
    			append_dev(section2, p3);
    			append_dev(article, t29);
    			append_dev(article, div7);
    			append_dev(article, t30);
    			append_dev(article, p4);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			const scrolly_changes = {};

    			if (dirty & /*$$scope, value*/ 257) {
    				scrolly_changes.$$scope = { dirty, ctx };
    			}

    			if (!updating_value && dirty & /*value*/ 1) {
    				updating_value = true;
    				scrolly_changes.value = /*value*/ ctx[0];
    				add_flush_callback(() => updating_value = false);
    			}

    			scrolly.$set(scrolly_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(scrolly.$$.fragment, local);
    			transition_in(visualization.$$.fragment, local);
    			transition_in(analysis.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(scrolly.$$.fragment, local);
    			transition_out(visualization.$$.fragment, local);
    			transition_out(analysis.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(section0);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(article);
    			destroy_component(scrolly);
    			destroy_component(visualization);
    			destroy_component(analysis);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('App', slots, []);
    	let conclusionVisible = false;
    	let value;

    	const steps = [
    		"<p>Welcome to the Jones Falls stream in Baltimore, Maryland. </p><p> Meet Mr. Trash Wheel®",
    		"<p>Mr. Trash Wheel® has a simple job. And that job is to consume garbage.</p><p> He does that by using the water's current or his solar panels to rake through debris. It's pretty amazing to see.",
    		"<p>How much trash does a guy like this filter? Here comes garbage now.</p>",
    		"<p>Look close! The blue dot represents a single plastic water bottle.</p>",
    		"<p>There goes a cigarette butt.</p>",
    		"<p>Anyone missing a ball? A glass bottle? Polyethylene? An old wrapper? A plastic bag? </p>",
    		"<p>Let's see how much comes through in a typical day's work, which we'll track as 24 hours.</p>",
    		"<p>Mr. Trash Wheel was first installed in May 9, 2014.</p>",
    		"<p>There are three other Baltimore-based machines: the Wheel family is completed by Captain Trash Wheel, Professor Trash Wheel, and most recently in 2021, Gwynnda the Good Wheel of the West.</p>",
    		"<p>On his best day, he picked up 38,000 lbs of garbage. The amount you're seeing now is just a fraction of that.</p>",
    		"<p>Automated cleanup projects, <a href='https://www.washingtonpost.com/science/2019/01/17/experts-warned-this-floating-garbage-collector-wouldnt-work-ocean-proved-them-right/'>especially at a larger scale,</a> have provoked skepticism from scientists in terms of practicality and impact.</p>",
    		"<p>Even still, the maker of Mr. Trash Wheel told <a href='https://www.newyorker.com/tech/annals-of-technology/the-promise-of-mr-trash-wheel'>The New Yorker</a> that the device is \"treating a symptom of the disease. It's not a cure.\"</p>",
    		"<p>These machines are placed a the mouth of rivers, which are a large source of plastic pollution in the oceans and can play an important part in cleanup.</p>"
    	];

    	function updateConclusionVisibility() {
    		document.querySelector(".conclusion");
    		const visualizationEnd = document.querySelector(".spacer:last-of-type").getBoundingClientRect().top;
    		conclusionVisible = visualizationEnd < 0;
    	}

    	onMount(() => {
    		window.addEventListener("scroll", updateConclusionVisibility);

    		return () => {
    			window.removeEventListener("scroll", updateConclusionVisibility);
    		};
    	});

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	function scrolly_value_binding(value$1) {
    		value = value$1;
    		$$invalidate(0, value);
    	}

    	$$self.$capture_state = () => ({
    		Visualization: Collection,
    		Scrolly,
    		Analysis,
    		conclusionVisible,
    		value,
    		steps,
    		updateConclusionVisibility,
    		onMount
    	});

    	$$self.$inject_state = $$props => {
    		if ('conclusionVisible' in $$props) conclusionVisible = $$props.conclusionVisible;
    		if ('value' in $$props) $$invalidate(0, value = $$props.value);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [value, steps, scrolly_value_binding];
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "App",
    			options,
    			id: create_fragment.name
    		});
    	}
    }

    const app = new App({
    	target: document.body,
    	props: {
    		name: 'world'
    	}
    });

    return app;

})();
//# sourceMappingURL=bundle.js.map
