fn main() {
    let v: Vec<i32> = vec![1, 2, 3];
    let x = v.get(10).unwrap();
    println!("{}", x);
}
