1. 根据公共数据hash获取铭文信息：

    /inscription/:hash

    GET

    参数：

    hash：公共数据hash

    返回：

    ```json
    {
        err: 0,
        msg: "错误信息",         // 如果err == 0，没有msg字段
        result: {               // 如果err != 0，没有result字段
            hash,               // 公共数据hash
            address,            // 铭文owner
            block_height,       // 创建区块高度
            timestamp,          // 创建时间
            text,               // 创建时写入的text
            price,              // 当前共鸣价格 string
            resonance_count     // 当前共鸣次数
        }
    }
    ```

2. 获取某地址拥有的铭文：

    /inscription_by_address/:address/:limit?/:offset?/:order?

    GET

    参数

    address：地址

    limit: 返回的列表的长度限制，默认为0

    offset: 返回的起始位置，默认为0

    order：desc - 按时间降序（默认）； asc - 按时间升序

    返回：

    ```json
    {
        err: 0,
        msg: "错误信息",
        result: {
            count,              // 总数
            list                // 列表，item数据格式同上
        }
    }
    ```

3. 获取区块范围内的新增的铭文 [begin, end)：

    /inscription_by_block/:begin_block/:end_block?/:limit?/:offset?/:order?

    GET

    参数

    begin_block：起始区块

    end_block: 结束区块，0表示一直获取到最新的，默认为0

    limit: 返回的列表的长度限制，默认为0

    offset: 返回的起始位置，默认为0

    order：desc - 按时间降序（默认）； asc - 按时间升序

    返回：

    ```json
    {
        err: 0,
        msg: "错误信息",
        result: {
            count,              // 总数
            list                // 列表，item数据格式同上
        }
    }
    ```

4. 获取铭文总数：

    /inscription_count

    GET

    返回：

    ```json
    {
        err: 0,
        msg: "错误信息",
        result: count
    }
    ```

5. 获取某数据的共鸣记录：

    /resonance_by_hash/:hash/:limit?/:offset?/:order?

    GET

    参数

    hash： 数据hash

    limit: 返回的列表的长度限制，默认为0

    offset: 返回的起始位置，默认为0

    order：desc - 按时间降序（默认）； asc - 按时间升序

    返回：

    ```json
    {
        err: 0,
        msg: "错误信息",
        result: {
            count,              // 总数
            list: [
                {
                    hash,               // 数据hash
                    inscription_id,     // 铭文id
                    address,            // 共鸣地址
                    content,            // 铭文内容
                    owner_bouns,        // 数据owner奖励 string
                    service_charge,     // 手续费 string
                    block_height,       // 共鸣区块
                    timestamp,          // 共鸣时间
                    txid,               // transfer txid
                    stage,              // 共鸣处于哪个阶段 'inscribe' or 'transfer'
                    genesis_block_height,
                    genesis_timestamp,
                    genesis_txid,
                }
            ]
        }
    }
    ```

6. 获取某地址的共鸣记录：

    /resonance_by_address/:address/:limit?/:offset?/:order?

    GET

    参数

    address: 地址

    limit: 返回的列表的长度限制，默认为0

    offset: 返回的起始位置，默认为0

    order：desc - 按时间降序（默认）； asc - 按时间升序

    返回：

    ```json
    {
        err: 0,
        msg: "错误信息",
        result: {
            count,              // 总数
            list                // 列表，item数据格式同上
        }
    }
    ```

7. 获取某数据的吟唱记录：

    /chant_by_hash/:hash/:limit?/:offset?/:order?

    GET

    参数

    hash: 数据hash

    limit: 返回的列表的长度限制，默认为0

    offset: 返回的起始位置，默认为0

    order：desc - 按时间降序（默认）； asc - 按时间升序

    返回：

    ```json
    {
        err: 0,
        msg: "错误信息",
        result: {
            count,              // 总数
            list: [
                {
                    hash,               // 数据hash
                    inscription_id,     // 铭文id
                    content,            // 铭文内容
                    address,            // 吟唱发起人地址
                    block_height,       // 吟唱区块
                    timestamp,
                    user_bouns,         // 吟唱人奖励 string
                    owner_bouns,        // 数据owner奖励 string
                }
            ]
        }
    }
    ```

8. 获取某数据的吟唱记录：

    /chant_by_address/:address/:limit?/:offset?/:order?

    GET

    参数

    address: 地址

    limit: 返回的列表的长度限制，默认为0

    offset: 返回的起始位置，默认为0

    order：desc - 按时间降序（默认）； asc - 按时间升序

    返回：

    ```json
    {
        err: 0,
        msg: "错误信息",
        result: {
            count,              // 总数
            list                // 列表，item数据格式同上
        }
    }
    ```

9. 获取某地址的mint记录：

    /mint_record_by_address/:address/:limit?/:offset?/:order?

    GET

    参数

    address: 地址

    limit: 返回的列表的长度限制，默认为0

    offset: 返回的起始位置，默认为0

    order：desc - 按时间降序（默认）； asc - 按时间升序

    返回：

    ```json
    {
        err: 0,
        msg: "错误信息",
        result: {
            count,              // 总数
            list: [
                {
                    inscription_id,     // mint id
                    content,            // 铭文内容
                    block_height,       // mint区块
                    timestamp,          // 时间
                    address,            // mint地址
                    amount,             // mint金额 string
                    lucky               // 幸运字串
                }
            ]
        }
    }
    ```

10. 获取幸运铭刻列表：

    /luck_mint/:limit?/:offset?/:order?

    GET

    参数

    limit: 返回的列表的长度限制，默认为0

    offset: 返回的起始位置，默认为0

    order：desc - 按时间降序（默认）； asc - 按时间升序

    返回：

    ```json
    {
        err: 0,
        msg: "错误信息",
        result: {
            count,              // 总数
            list                // 列表，item数据格式同上，再加上 txid
        }
    }
    ```

11. 获取过去24小时mint总量：

    /mint_last_24

    GET

    返回：

    ```json
    {
        err: 0,
        msg: "错误信息",
        result: totalAmount     // string
    }
    ```
    
12. 获取某地址余额：

    /balance/:address

    GET

    参数

    address: 返回的列表的长度限制，默认为0

    返回：

    ```json
    {
        err: 0,
        msg: "错误信息",
        result: balance     // string
    }
    ```

13. 获取当前index服务的同步状态：

    /indexer/state

    GET

    返回：

    ```json
    {
        err: 0,
        msg: "错误信息",
        result: {
            eth_height,         // 已处理的eth的高度 int
            btc_height          // 已处理的btc的高度 int
        }
    }
    ```

14. 获取当前btc链最新的块号：

    /block_height/btc

    GET

    返回：

    ```json
    {
        err: 0,
        msg: "错误信息",
        result: height
    }
    ```

15. 获取某地址在时间段内的收益：

    /income/:address/:begin_time/:end_time?

    GET

    参数

    begin_time: 起始时间（UTC）
    end_time: 结束时间，默认到当前时间

    返回：

    ```json
    {
        err: 0,
        msg: "错误信息",
        result: {
            mint,               // mint部分 string
            chant_bouns,        // 吟唱奖励 string
            chanted_bouns,      // 被他人吟唱的奖励 string
            resonance_bouns     // 数据被共鸣的奖励 string
        }
    }
    ```

16. 根据txid搜索：

    /search/:txid

    GET

    参数

    txid: 交易id

    返回：

    ```json
    {
        err: 0,
        msg: "错误信息",
        result: {
            type,               // mint or resonance or chant or transfer or inscribe or set_price
            ...                 // 其他数据参考上面对应数据
        }
    }
    ```

17. 查询mint进度

    /mint_progress

    GET

    返回：

    ```json
    {
        err: 0,
        msg: "错误信息",
        result: {
            total,              // string 总量
            service_charged,    // string 通过手续费返回mintpool的量
            pool_balance        // string mint pool余额
        }
    }
    ```