
window.list_views = {};

function createListView(id)
{
    let view = {};
    view['busy'] = false;
    view['repaint'] = false;
    view['body'] = document.querySelector('#' + id);
    view['events'] = { 'click' : {} };
    view['task_count'] = 0;

    chrome.storage.onChanged.addListener(function(changes, namespace) {
        if (view['busy'] == true)
            view['busy'] = false;
        else
            view['update_view']();
    });

    view['body'].addEventListener('click', function(e)
    {
        if(e.target)
        {
            for (const [key, func] of Object.entries(view['events']['click']))
            {
                if (e.target.classList.contains(key))
                    return func(e);
            }
        }
     });

    async function getTab(tab)
    {
        return new Promise((resolve, reject) => {
            if (tab == null)
                chrome.storage.sync.get(null, resolve);
            else
                chrome.storage.sync.get(['' + tab], resolve);
        }).then(function(result) {
            if (chrome.runtime.lastError)
            {
                alert(chrome.runtime.lastError.message);
                return null;
            }
            
            if (result != null)
            {
                if (tab == null)
                    return result;
                else
                    return JSON.parse(result['' + tab]);
            }
            return null;
        });
    }

    async function setTab(tab, source)
    {
        return new Promise((resolve, reject) => {
            view['busy'] = true;
            let key = '' + tab;
            let scheme = {};
            scheme[key] = ( typeof source == 'string' ? source : JSON.stringify(source) );
            chrome.storage.sync.set(scheme, resolve);
        }).then(function() {
            if (chrome.runtime.lastError)
                return alert(chrome.runtime.lastError.message);
        });
    }

    async function currentTab()
    {
        return new Promise((resolve, reject) => {
            chrome.storage.sync.get(['current_tab'], resolve);
        }).then(function(result) {
            if (chrome.runtime.lastError)
            {
                alert(chrome.runtime.lastError.message);
                return -1;
            }
            
            if (result != null)
                return parseInt(result['current_tab']);
            return -1;
        });
    }

    async function setCurrentTab(tab)
    {
        return new Promise((resolve, reject) => {
            view['busy'] = true;
            let val = '' + tab;
            let scheme = { 'current_tab' : val};
            chrome.storage.sync.set(scheme, resolve);
        }).then(function() {
            if (chrome.runtime.lastError)
                return alert(chrome.runtime.lastError.message);
        });
    }

    async function removeTab(tab)
    {
        let list = await getTab(null);
        if (list == null)
            return;
        delete list['current_tab'];
        let allKeys = Object.keys(list);
        let last_idx = allKeys.length - 1;
        if (last_idx != tab)
        {
            let hasChanges = false;
            for (let k of allKeys)
            {
                let idx = parseInt(k);
                if (idx == NaN)
                    continue;
                if (idx > tab)
                {
                    await setTab(idx - 1, list[k]);
                    hasChanges = true;
                }
            }

            if (!hasChanges)
                return;
        }

        return new Promise((resolve, reject) => {
            view['busy'] = true;
            chrome.storage.sync.remove('' + last_idx, resolve);
        }).then(() => {
            if (chrome.runtime.lastError)
                return alert(chrome.runtime.lastError.message);
        });
    }

    async function countTabs()
    {
        let list = await getTab(null);
        if (list == null)
            return -1;
        delete list['current_tab'];
        return Object.keys(list).length;
    }

    function createTabHtml(number, name)
    {
        let base_id = id + '_tab_' + number;
        let link = document.createElement('span');
        link.setAttribute('class', 'tablinks ' + base_id);
        link.setAttribute('id', base_id);
        view['events']['click'][base_id] = function(e)
        {
            view.openTab(e, number);
        };

        link.innerHTML = name
            + '<button class="removetab ' + base_id + '_removetab"></button>';

        view['events']['click'][base_id + '_removetab'] = function(e)
        {
            view.removeTab(e, number);
        };

        view['tabs'].append(link);

        let tab_body = document.createElement('div');
        tab_body.setAttribute('id', id + '_tab_body_' + number);
        tab_body.setAttribute('class', 'tabcontent');

        let addListButton = document.createElement('button');
        addListButton.setAttribute('class', 'addlist ' + base_id + '_addlist');
        view['events']['click'][base_id + '_addlist'] = function(e)
        {
            view.addList(e, number);
        };
        tab_body.append(addListButton);

        view['body'].append(tab_body);

        return tab_body;
    }

    function createListHtml(tab, number, name, target = null)
    {
        let base_id = id + '_list_header_' + tab + '_' + number;
        let listHeader = document.createElement('h4');
        listHeader.innerHTML = '<span>' + name + '</span>';
        listHeader.setAttribute('id', base_id);

        let addTaskButton = document.createElement('button');
        addTaskButton.setAttribute('class', 'addtask  ' + base_id + '_addtask');
        view['events']['click'][base_id + '_addtask'] = function(e)
        {
            view.addTask(e, tab, number);
        };
        listHeader.append(addTaskButton);

        let removeListButton = document.createElement('button');
        removeListButton.setAttribute('class', 'removelist ' + base_id + '_removelist');
        view['events']['click'][base_id + '_removelist'] = function(e)
        {
            view.removeList(e, tab, number);
        };
        listHeader.append(removeListButton);

        let list = document.createElement('ul');
        list.setAttribute('id', id + '_list_' + tab + '_' + number);

        if (target != null)
        {
            target.append(listHeader);
            target.append(list);
        }
        else
        {
            let target_tab = view['body'].querySelector('#' + id + '_tab_body_' + tab);
            target_tab.append(listHeader);
            target_tab.append(list);
        }

        return list;
    }

    function createTaskHtml(tab, list, number, text, status, target = null)
    {
        let base_id = id + '_task_' + tab + '_' + list + '_' + number;

        let task = document.createElement('li');
        task.setAttribute('class', status + ' priority_' + list);
        task.setAttribute('id', base_id);
        
        let task_body = '';
        task_body += '<button class="uptask ' + base_id + '_uptask"></button>';
        task_body += '<button class="downtask ' + base_id + '_downtask"></button>';
        task_body += '<span>' + text + '</span>';
        task_body += '<button class="edittask ' + base_id + '_edittask"></button>';
        task_body += '<button class="deltask ' + base_id + '_deltask"></button>';
        task_body += '<button class="completetask ' + base_id + '_completetask"></button>';
        
        view['events']['click'][base_id + '_uptask'] = function(e)
        {
            view.upTask(e, tab, list, number);
        };
        
        view['events']['click'][base_id + '_downtask'] = function(e)
        {
            view.downTask(e, tab, list, number);
        };
        
        view['events']['click'][base_id + '_edittask'] = function(e)
        {
            view.editTask(e, tab, list, number);
        };
        
        view['events']['click'][base_id + '_deltask'] = function(e)
        {
            view.delTask(e, tab, list, number);
        };
        
        view['events']['click'][base_id + '_completetask'] = function(e)
        {
            view.completeTask(e, tab, list, number);
        };

        task.innerHTML = task_body;

        if (target != null)
        {
            target.append(task);
        }
        else
        {
            let target_list = view['body'].querySelector('#' + id + '_list_' + tab + '_' + list);
            target_list.append(task);
        }

        return task;
    }

    view['addTab'] = async function(e)
    {
        result = window.prompt('Enter tab name:', 'New tab');
        if (result == null)
            return;
        result = result.replace(/(<([^>]+)>)/gi, '').trim();
        if (result == '')
            return;

        let idx = await countTabs();
        if (idx < 0)
            return;
        await setTab(idx, {'name' : result, 'lists' : []});
        
        createTabHtml(idx, result);

        if (idx == 0)
        {
            view['openTab'](null, 0);
            await setCurrentTab(0);
        }
    }

    view['openTab'] = async function(e, tab)
    {
        var i, tabcontent, tablinks;

        tabcontent = view['body'].getElementsByClassName('tabcontent');
        for (i = 0; i < tabcontent.length; i++)
            tabcontent[i].style.display = 'none';

        tablinks = view['body'].getElementsByClassName('tablinks');
        for (i = 0; i < tablinks.length; i++)
            tablinks[i].className = tablinks[i].className.replace(' active', '');

        let active = document.getElementById(id + '_tab_' + tab);
        let active_body = document.getElementById(id + '_tab_body_' + tab);
        if (active && active_body)
        {
            active_body.style.display = 'block';
            active.className += ' active';
            if (e != null)
                await setCurrentTab(tab);
        }
    }

    view['removeTab'] = async function(e, tab)
    {
        if (!confirm('Are you sure you want to delete the tab?'))
            return;

        await removeTab(tab);

        view['update_view']();
    }

    view['addList'] = async function(e, tab)
    {
        result = window.prompt('Enter list name:', 'New list');
        if (result == null)
            return;
        result = result.replace(/(<([^>]+)>)/gi, '').trim();
        if (result == '')
            return;

        let tab_item = await getTab(tab);
        if (tab_item == null)
            return;

        let idx = tab_item['lists'].length;
        tab_item['lists'].push({'name' : result, 'tasks' : []});

        await setTab(tab, tab_item);
        
        createListHtml(tab, idx, result);
    }

    view['removeList'] = async function(e, tab, list)
    {
        if (!confirm('Are you sure you want to delete the list?'))
            return;
        
        let tab_item = await getTab(tab);
        if (tab_item == null)
            return;

        tab_item['lists'].splice(list, 1);

        await setTab(tab, tab_item);

        view['update_view']();
    }

    view['addTask'] = async function(e, tab, list)
    {
        result = window.prompt('Enter task text:', 'TODO');
        if (result == null)
            return;
        result = result.replace(/(<([^>]+)>)/gi, '').trim();
        if (result == '')
            return;

        let tab_item = await getTab(tab);
        if (tab_item == null)
            return;

        let idx = tab_item['lists'][list]['tasks'].length;
        tab_item['lists'][list]['tasks'].push({'text' : result, 'status' : 'todo'});
        
        await setTab(tab, tab_item);
        
        createTaskHtml(tab, list, idx, result, 'todo');

        view['task_count'] += 1;
        chrome.action.setBadgeText({ text: '' + view['task_count'] });
    }

    view['editTask'] = async function(e, tab, list, task)
    {
        let tab_item = await getTab(tab);
        if (tab_item == null)
            return;

        let task_item = tab_item['lists'][list]['tasks'][task];

        result = window.prompt('Enter task text:', task_item['text']);
        if (result == null)
            return;
        result = result.replace(/(<([^>]+)>)/gi, '').trim();
        if (result == '' || result == task_item['text'])
            return;

        tab_item['lists'][list]['tasks'][task]['text'] = result;

        await setTab(tab, tab_item);
        
        let task_html = view['body'].querySelector('#' + id + '_task_' + tab + '_' + list + '_' + task + ' span');
        task_html.innerHTML = result;
    }

    view['upTask'] = async function(e, tab, list, task)
    {
        if (task == 0)
            return;

        let tab_item = await getTab(tab);
        if (tab_item == null)
            return;

        let task_item = tab_item['lists'][list]['tasks'][task];
        tab_item['lists'][list]['tasks'][task] = tab_item['lists'][list]['tasks'][task - 1];
        tab_item['lists'][list]['tasks'][task - 1] = task_item;

        await setTab(tab, tab_item);
        
        view['update_view']();
    }

    view['downTask'] = async function(e, tab, list, task)
    {
        let tab_item = await getTab(tab);
        if (tab_item == null)
            return;

        if (task >= tab_item['lists'][list]['tasks'].length - 1)
            return;

        let task_item = tab_item['lists'][list]['tasks'][task];
        tab_item['lists'][list]['tasks'][task] = tab_item['lists'][list]['tasks'][task + 1];
        tab_item['lists'][list]['tasks'][task + 1] = task_item;

        await setTab(tab, tab_item);
        
        view['update_view']();
    }
    
    view['delTask'] = async function(e, tab, list, task)
    {
        let tab_item = await getTab(tab);
        if (tab_item == null)
            return;

        tab_item['lists'][list]['tasks'].splice(task, 1);

        await setTab(tab, tab_item);
        
        view['update_view']();
    }

    view['completeTask'] = async function(e, tab, list, task)
    {
        let tab_item = await getTab(tab);
        if (tab_item == null)
            return;

        let status = tab_item['lists'][list]['tasks'][task]['status'];

        if (status == 'todo')
            status = 'complete';
        else
            status = 'todo';
        tab_item['lists'][list]['tasks'][task]['status'] = status;

        await setTab(tab, tab_item);
        
        let task_html = view['body'].querySelector('#' + id + '_task_' + tab + '_' + list + '_' + task);
        
        if (status == 'todo' && task_html.classList.contains('complete'))
        {
            task_html.classList.remove('complete');
            task_html.classList.add('todo');

            view['task_count'] += 1;
            chrome.action.setBadgeText({ text: '' + view['task_count'] });
        }
        else if (status == 'complete' && task_html.classList.contains('todo'))
        {
            task_html.classList.remove('todo');
            task_html.classList.add('complete');

            view['task_count'] -= 1;
            if (view['task_count'] > 0)
                chrome.action.setBadgeText({ text: '' + view['task_count'] });
            else
                chrome.action.setBadgeText({ text: '' });
        }
    }

    view['update_view'] = async function()
    {
        if (view['repaint'] == true)
            return;
        view['repaint'] = true;

        let current_tab = -1;
        tablinks = view['body'].getElementsByClassName('tablinks');
        for (i = 0; i < tablinks.length; i++)
        {
            if (tablinks[i].classList.contains('active'))
            {
                current_tab = i - 1;
                break;
            }
        }

        view['body'].innerHTML = '';

        if (current_tab == -1)
        {
            let new_current_tab = await currentTab();
            if (new_current_tab != null)
                current_tab = new_current_tab;
        }

        view['events'] = { 'click' : {} };

        view['tabs'] = document.createElement('div');
        view['tabs'].setAttribute('class', 'tab');
        view['tabs'].innerHTML = '<button class="tablinks addtab ' + id + '_addtab"></button>';
        
        view['events']['click'][id + '_addtab'] = function(e)
        {
            view.addTab(e);
        };

        view['body'].append(view['tabs']);

        let tab_item = await getTab(null);
        if (tab_item == null)
        {
            view['repaint'] = false;
            return;
        }

        delete tab_item['current_tab'];

        let objects = Object.entries(tab_item);
        if (current_tab >= objects.length)
            current_tab = -1; 

        view['task_count'] = 0;
        for (const [str_num, str_code] of objects)
        {
            let tab = JSON.parse(str_code);
            let key = parseInt(str_num);
            let tab_html = createTabHtml(key, tab['name']);

            for (let index in tab['lists'])
            {
                let list = tab['lists'][index];
                let list_html = createListHtml(key, parseInt(index), list['name'], tab_html);
                for (let num in list['tasks'])
                {
                    let task = list['tasks'][num];
                    createTaskHtml(key, parseInt(index), parseInt(num), task['text'], task['status'], list_html);
                    
                    if (task['status'] == 'todo')
                        view['task_count'] += 1;
                }
            }
        }

        if (view['task_count'] > 0)
            chrome.action.setBadgeText({ text: '' + view['task_count'] });
        else
            chrome.action.setBadgeText({ text: '' });

        if (current_tab != -1)
            view['openTab'](null, current_tab);
        else
            view['openTab'](null, 0);
        
        view['repaint'] = false;
    }

    window.list_views[id] = view;

    view['update_view']();
}

createListView('todo_body');