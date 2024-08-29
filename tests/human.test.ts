import {describe, expect, test} from '@jest/globals';
import { SandboxModeConfig, SandboxUsers, SimplePayStart } from '../src/simple-pay';
import { makeid } from './utils';

const merchant = SandboxUsers[0];
const config = SandboxModeConfig;

describe("Start Transaction", () => {

    const orderRef = makeid(24);
    let timeout = new Date();
    timeout.setMinutes(timeout.getMinutes()+5);

    let created_trans = null;

    test("Starting a succesfull transaction", ()=>{
        let start_trans = new SimplePayStart(merchant, config);
        start_trans.setCustomerEmail("kicsibali@gmail.com");
        start_trans.setOrderRef(orderRef);
        start_trans.setTimeout(timeout);
        start_trans.setTotal(1000);
        start_trans.card().then((r)=>{
            created_trans = r;
            expect(!r.transactionId).toBe(false);
        });
    });

    test("Already made transaction", ()=>{
        let start_trans = new SimplePayStart(merchant, config);
        start_trans.setCustomerEmail("kicsibali@gmail.com");
        start_trans.setOrderRef(orderRef);
        start_trans.setTimeout(timeout);
        start_trans.setTotal(1000);
        start_trans.card().then((r)=>{
            
        }, (e)=>{
            expect(e).toBeTruthy();
        });
    });


});