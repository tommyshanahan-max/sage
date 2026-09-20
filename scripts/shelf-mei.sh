#!/bin/sh
# HER LAST ORDER, AS A SHOP.
#
# Seven things off the cart she sent Tom, with her prices and the pictures
# cropped out of the same screenshots. Run once from ~/tc on the box:
#
#   sh scripts/shelf-mei.sh
#
# Safe to read before running: it only adds catalogue rows and attaches the
# pictures in scripts/brand/shop/. Running it twice makes a second set of
# rows — `make catalogue` and `make product-off N=` if that happens.
set -e
cd "$(dirname "$0")/.."

make product NAME="Swisse 深海鱼油 400粒" PRICE="¥149" UNIT="400粒" EN="Swisse Odourless Wild Fish Oil 1500mg 400 caps"
make product NAME="Swisse 儿童综合维生素片 直邮" PRICE="¥75" UNIT="120片" EN="Swisse Children's Ultivite 120 chewables"
make product NAME="爱他美金装 1段 900g 0-6个月 三罐装" PRICE="¥598" UNIT="900g x3罐" EN="Aptamil Gold+ Stage 1 900g x3"
make product NAME="爱他美金装 3段 900g 1-2岁 三罐装" PRICE="¥560" UNIT="900g x3罐" EN="Aptamil Gold+ Stage 3 900g x3"
make product NAME="爱他美金装 4段 900g 2岁以上 三罐装" PRICE="¥480" UNIT="900g x3罐" EN="Aptamil Gold+ Junior Stage 4 900g x3"
make product NAME="Life Space 孕妇益生菌" PRICE="¥175" UNIT="60粒" EN="Life Space Probiotic Pregnancy & Breastfeeding 60 caps"
make product NAME="Life Space 婴儿益生菌" PRICE="¥175" UNIT="60g" EN="Life Space Probiotic Powder for Baby 60g"

# The pictures, by the row each one just took. `make catalogue` prints the
# numbers; these follow the order above, after whatever was already there.
N=$(make -s catalogue | grep -cE '^ +[0-9]+\.')
FIRST=$((N - 6))
i=$FIRST
for pic in fishoil kidsvit aptamil1 aptamil3 aptamil4 probpreg probbaby; do
  make product-photo N=$i < "scripts/brand/shop/$pic.jpg"
  i=$((i + 1))
done

echo
echo "  The shelf is up."
make catalogue
