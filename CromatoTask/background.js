
function updateBadge()
{
    chrome.storage.sync.get(null, function(result)
    {
        if (chrome.runtime.lastError)
            return;
        
        let task_count = 0;
        if (result != null)
        {
            delete result['current_tab'];
            for (const [str_num, str_code] of Object.entries(result))
            {
                let tab = JSON.parse(str_code);
                for (let index in tab['lists'])
                {
                    let list = tab['lists'][index];
                    for (let num in list['tasks'])
                        if (list['tasks'][num]['status'] == 'todo')
                            task_count += 1;
                }
            }

            if (task_count > 0)
                chrome.action.setBadgeText({ text: '' + task_count });
            else
                chrome.action.setBadgeText({ text: '' });
        }
    });
}

chrome.runtime.onInstalled.addListener(function()
{
    updateBadge();
});